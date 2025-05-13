import React, { useState, useEffect, useRef } from 'react';
import AudioControls from './AudioControls';
import ShlokaDisplay from './ShlokaDisplay';

const ShlokaPlayer = ({ shlokaData }) => {
  const [activeLine, setActiveLine] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repetitionCount, setRepetitionCount] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [playingFullShloka, setPlayingFullShloka] = useState(true);
  
  const fullAudioRef = useRef(null);
  const lineAudioRefs = useRef([]);
  const MAX_REPETITIONS = 5;

  useEffect(() => {
    lineAudioRefs.current = shlokaData.text.map(() => React.createRef());
  }, [shlokaData.text]);

  useEffect(() => {
    const createAudioElement = (src) => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      return audio;
    };

    fullAudioRef.current = createAudioElement(shlokaData.audioFiles.full);
    lineAudioRefs.current = shlokaData.audioFiles.lines.map(src => createAudioElement(src));

    const handleFullAudioEnded = () => {
      setPlayingFullShloka(false);
      setActiveLine(1);
      playLineAudio(0);
    };

    const handleLineAudioEnded = (lineIndex) => {
      const nextRepetitionCount = repetitionCount + 1;
      
      if (nextRepetitionCount < MAX_REPETITIONS) {
        setRepetitionCount(nextRepetitionCount);
        playLineAudio(lineIndex);
      } else {
        const nextLineIndex = lineIndex + 1;
        if (nextLineIndex < shlokaData.text.length) {
          setActiveLine(nextLineIndex + 1);
          setRepetitionCount(0);
          playLineAudio(nextLineIndex);
        } else {
          setActiveLine(1);
          setRepetitionCount(0);
          playLineAudio(0);
        }
      }
    };

    fullAudioRef.current.addEventListener('ended', handleFullAudioEnded);
    lineAudioRefs.current.forEach((audioRef, index) => {
      audioRef.addEventListener('ended', () => handleLineAudioEnded(index));
    });

    return () => {
      fullAudioRef.current.removeEventListener('ended', handleFullAudioEnded);
      lineAudioRefs.current.forEach((audioRef, index) => {
        audioRef.removeEventListener('ended', () => handleLineAudioEnded(index));
      });
    };
  }, [shlokaData.audioFiles, repetitionCount]);

  const playFullAudio = () => {
    pauseAllLineAudio();
    setIsPlaying(true);
    setPlayingFullShloka(true);
    fullAudioRef.current.currentTime = 0;
    fullAudioRef.current.play();
  };

  const playLineAudio = (lineIndex) => {
    pauseAllLineAudio();
    pauseFullAudio();
    setIsPlaying(true);
    lineAudioRefs.current[lineIndex].currentTime = 0;
    lineAudioRefs.current[lineIndex].play();
  };

  const pauseAllLineAudio = () => {
    lineAudioRefs.current.forEach(audioRef => {
      if (audioRef) {
        audioRef.pause();
      }
    });
  };

  const pauseFullAudio = () => {
    if (fullAudioRef.current) {
      fullAudioRef.current.pause();
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      if (playingFullShloka) {
        pauseFullAudio();
      } else {
        pauseAllLineAudio();
      }
      setIsPlaying(false);
    } else {
      if (!initialized) {
        setInitialized(true);
        playFullAudio();
      } else if (playingFullShloka) {
        fullAudioRef.current.play();
        setIsPlaying(true);
      } else {
        const lineIndex = activeLine - 1;
        if (lineIndex >= 0 && lineIndex < lineAudioRefs.current.length) {
          lineAudioRefs.current[lineIndex].play();
          setIsPlaying(true);
        }
      }
    }
  };

  const handlePrevious = () => {
    if (playingFullShloka) {
      pauseFullAudio();
    } else {
      pauseAllLineAudio();
    }

    let prevLine;
    if (activeLine <= 1) {
      prevLine = shlokaData.text.length;
      setPlayingFullShloka(false);
    } else if (activeLine === 2 && repetitionCount === 0) {
      prevLine = 0;
      setPlayingFullShloka(true);
    } else {
      prevLine = activeLine - 1;
      setPlayingFullShloka(false);
    }

    setActiveLine(prevLine);
    setRepetitionCount(0);

    if (prevLine === 0) {
      playFullAudio();
    } else {
      playLineAudio(prevLine - 1);
    }
  };

  const handleNext = () => {
    if (playingFullShloka) {
      pauseFullAudio();
    } else {
      pauseAllLineAudio();
    }

    let nextLine;
    if (playingFullShloka) {
      nextLine = 1;
      setPlayingFullShloka(false);
    } else if (activeLine >= shlokaData.text.length) {
      nextLine = 0;
      setPlayingFullShloka(true);
    } else {
      nextLine = activeLine + 1;
      setPlayingFullShloka(false);
    }

    setActiveLine(nextLine);
    setRepetitionCount(0);

    if (nextLine === 0) {
      playFullAudio();
    } else {
      playLineAudio(nextLine - 1);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-6 md:p-8 transition-shadow duration-300 hover:shadow-xl">
      <div className="text-center mb-6 pb-4 border-b border-gray-200">
        <h2 className="text-2xl font-semibold text-secondary">{shlokaData.title}</h2>
      </div>
      
      <ShlokaDisplay 
        shlokaText={shlokaData.text}
        translation={shlokaData.translation}
        meaning={shlokaData.meaning}
        activeLine={activeLine}
        playingFullShloka={playingFullShloka}
      />
      
      {!playingFullShloka && activeLine > 0 && (
        <div className="text-center mt-4 mb-6">
          <span className="inline-block px-3 py-1 bg-accent/20 rounded-full text-sm font-medium text-secondary">
            Repetition: {repetitionCount + 1} of {MAX_REPETITIONS}
          </span>
        </div>
      )}
      
      <AudioControls 
        isPlaying={isPlaying}
        onPlayPauseClick={handlePlayPause}
        onPreviousClick={handlePrevious}
        onNextClick={handleNext}
      />
    </div>
  );
};

export default ShlokaPlayer;