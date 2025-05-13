import React from 'react';
// ICONS
import { MdOutlineSkipPrevious, MdPlayArrow } from "react-icons/md";
import { MdSkipNext } from "react-icons/md";
import { CiPause1 } from "react-icons/ci";
// import { BiHide } from "react-icons/bi";
const AudioControls = ({ isPlaying, onPlayPauseClick, onPreviousClick, onNextClick }) => {
  return (
    <div className="flex justify-center items-center gap-6 py-4">
      <button 
        className="btn-control"
        aria-label="Previous line"
        onClick={onPreviousClick}
      >
        <MdOutlineSkipPrevious />
      </button>
      
      <button 
        className="btn-play"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={onPlayPauseClick}
      >
        {isPlaying ? <CiPause1 /> : <MdPlayArrow />}
      </button>
      
      <button 
        className="btn-control"
        aria-label="Next line"
        onClick={onNextClick}
      >
        <MdSkipNext />
      </button>
    </div>
  );
};

export default AudioControls;