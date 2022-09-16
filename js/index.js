window.AudioContext = window.AudioContext || window.webkitAudioContext;

var middleA=440
var semitone = 69

var audioContext = null;
var isPlaying = false;
var sourceNode = null;
var analyser = null;
var theBuffer = null;
var DEBUGCANVAS = null;
var mediaStreamSource = null;
var detectorElem, 
	canvasElem,
	waveCanvas,
	pitchElem,
	noteElem,
	octaveElem,
	detuneElem,
	detuneAmount;

var rafID = null;
var tracks = null;
var buflen = 2048;
var buf = new Float32Array( buflen );

var noteStrings = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
var startRecord = null
var meter=null

window.onload = function() {
    audioContext = new AudioContext();
    var request = new XMLHttpRequest();
	request.open("GET", "../sounds/empty_audio.ogg", true);
	request.responseType = "arraybuffer";
	request.onload = function() {
	  audioContext.decodeAudioData( request.response, function(buffer) { 
	    	theBuffer = buffer;
		} );
	}
	request.send();

	detectorElem = document.getElementById( "detector" );
    pitchElem = document.getElementById( "pitch" );
	noteElem = document.getElementById( "note" );
	octaveElem = document.getElementById( "octave" );
    detectorCallback()


    startRecord = document.querySelector('#start-record')
    startRecord.addEventListener('click', function(){
		startRecord.classList.add('disabled')
		toggleLiveInput()
	})



	const Meter = function(selector) {
		this.$root = document.querySelector(selector)
		this.$pointer = this.$root.querySelector('.neckJS')
		this.init()
	  }
	
	Meter.prototype.init = function() {
		for (var i = 0; i <= 10; i += 1) {
		  const $scale = document.createElement('div')
		  $scale.className = 'meter-scale'
		  $scale.style.transform = 'rotate(' + (i * 9 - 45) + 'deg)'
		  if (i % 5 === 0) {
			$scale.classList.add('meter-scale-strong')
		  }
		  this.$root.querySelector('.neck__wrapper').appendChild($scale)
		}
	  }
	
	/**
	 * @param {number} deg
	 */
	Meter.prototype.update = function(deg) {
	this.$pointer.style.transform = 'rotate(' + deg + 'deg)'
	}
	meter = new Meter('.meterJS')


}




function detectorCallback(){
    detectorElem.ondragenter = function () { 
		this.classList.add("droptarget"); 
		return false; };
	detectorElem.ondragleave = function () { this.classList.remove("droptarget"); return false; };
	detectorElem.ondrop = function (e) {
  		this.classList.remove("droptarget");
  		e.preventDefault();
		theBuffer = null;

	  	var reader = new FileReader();
	  	reader.onload = function (event) {
	  		audioContext.decodeAudioData( event.target.result, function(buffer) {
	    		theBuffer = buffer;
	  		}, function(){alert("error loading!");} ); 

	  	};
	  	reader.onerror = function (event) {
	  		alert("Error: " + reader.error );
		};
	  	reader.readAsArrayBuffer(e.dataTransfer.files[0]);
	  	return false;
	};
}

function frequencyFrombuffer( buffer, sampleRate ) {
	// Implements the ACF2+ algorithm
	var buf_size = buffer.length;
	var root_main_square = 0;
    var enough_signal_threshold = 0.01
	var buf_radius_start=0, buf_radius_end=buf_size-1, buf_threshold=0.2;
    var content = null
    var d=0;
	var maxval=-1, maxpos=-1;
    var T0 = null, x1=null, x2=null, x3=null;

	for (var i=0;i<buf_size;i++) {
		var val = buffer[i];
		root_main_square += val*val;
	}
	root_main_square = Math.sqrt(root_main_square/buf_size);
	if (root_main_square< enough_signal_threshold) // not enough signal
		return -1;

	for (var i=0; i<buf_size/2; i++)
		if (Math.abs(buffer[i])<buf_threshold) { buf_radius_start=i; break; }
	for (var i=1; i<buf_size/2; i++)
		if (Math.abs(buffer[buf_size-i])<buf_threshold) { buf_radius_end=buf_size-i; break; }

	buffer = buffer.slice(buf_radius_start,buf_radius_end);
	buf_size = buffer.length;

	content = new Array(buf_size).fill(0);
	for (var i=0; i<buf_size; i++)
		for (var j=0; j<buf_size-i; j++)
            content[i] = content[i] + buffer[j]*buffer[j+i];

	while (content[d]>content[d+1]) d++;
	for (var i=d; i<buf_size; i++) {
		if (content[i] > maxval) {
			maxval = content[i];
			maxpos = i;
		}
	}
	T0 = maxpos;

	x1=content[T0-1], x2=content[T0], x3=content[T0+1];
	a = (x1 + x3 - 2*x2)/2;
	b = (x3 - x1)/2;
	if (a) T0 = T0 - b/(2*a);

	return sampleRate/T0;
}

function streamError() {
    alert('Stream generation failed.');
}
function getUserMedia(dictionary, callback) {
    try {
        navigator.getUserMedia = 
        	navigator.getUserMedia ||
        	navigator.webkitGetUserMedia ||
        	navigator.mozGetUserMedia;
        navigator.getUserMedia(dictionary, callback, streamError);
    } catch (e) {
        alert('getUserMedia threw exception :' + e);
    }
}

function togglePlayback() {
    if (isPlaying) {
        //stop playing and return
        sourceNode.stop( 0 );
        sourceNode = null;
        analyser = null;
        isPlaying = false;
		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        window.cancelAnimationFrame( rafID );
        return "start";
    }

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = theBuffer;
    sourceNode.loop = true;

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    sourceNode.connect( analyser );
    analyser.connect( audioContext.destination );
    sourceNode.start( 0 );
    isPlaying = true;
    isLiveInput = false;
    updatePitch();

    return "stop";
}

function toggleLiveInput() {
    togglePlayback()

    if (isPlaying) {
        //stop playing and return
        sourceNode.stop( 0 );
        sourceNode = null;
        analyser = null;
        isPlaying = false;
		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        window.cancelAnimationFrame( rafID );
    }
    getUserMedia(
    	{
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream);
}

function gotStream(stream) {
    // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);

    // Connect it to the destination.
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    mediaStreamSource.connect( analyser );
    updatePitch();
}


function updatePitch( time ) {
	var cycles = new Array;
	analyser.getFloatTimeDomainData( buf );
	var ffb = frequencyFrombuffer( buf, audioContext.sampleRate );
	// TODO: Paint confidence meter on canvasElem here.


 	if (ffb == -1) {
 		//detectorElem.className = "vague";
	 	//pitchElem.innerText = "--";
		//noteElem.innerText = "-";
 	} else {
	 	detectorElem.className = "confident";
	 	pitch = ffb;
	 	pitchElem.innerText = Math.round( pitch ) ;
	 	var note =  noteFromPitch( pitch );
		var cents = centsFromNote(pitch, note);
		
		meter.update((cents / 50) * 45)

        var octave = null
        if( (parseInt(note / 12) - 1) <= 8 &&  (parseInt(note / 12) - 1) >= 0){
            octave = (parseInt(note / 12) - 1)
        }

        var noteName = noteStrings[note%12]

         if(noteName && octave){
            noteElem.innerHTML = noteName;
			octaveElem.innerHTML = octave;
         }
	}

	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = window.webkitRequestAnimationFrame;
	rafID = window.requestAnimationFrame( updatePitch );
}

function noteFromPitch( frequency ) {
	if(frequency>16 && frequency<7903){
		var noteNum = 12 * (Math.log( frequency / middleA )/Math.log(2) );
		return Math.round( noteNum ) + semitone;
	}
}



/**
 * get cents difference between given frequency and musical note's standard frequency
 *
 * @param {number} frequency
 * @param {number} note
 * @returns {number}
 */
function centsFromNote( frequency, note ) {
	return Math.floor(
		(1200 * Math.log(frequency / getStandardFrequency(note))) / Math.log(2)
	)
}



/**
 * get the musical note's standard frequency
 *
 */
 function getStandardFrequency(note) {
	return middleA * Math.pow(2, (note - semitone) / 12)

}
