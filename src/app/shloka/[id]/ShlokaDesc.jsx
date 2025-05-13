"use client";
import { Heart } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import ShlokaDisplay from "./ShlokaDisplay";
// ICONS
import { MdOutlineSkipPrevious, MdPlayArrow } from "react-icons/md";
import { MdSkipNext } from "react-icons/md";
// import { CiPause1 } from "react-icons/ci";
import { BiHide } from "react-icons/bi";
import { CiPause1 } from "react-icons/ci";


const shlokaData = {
  title: "Ayurvedic Principle",
  text: [
    "लङ्घनं स्वेदनं कालो यवाग्वस्तिक्तको रसः||१४२||",
    "पाचनान्यविपक्वानां दोषाणां तरुणे ज्वरे|१४३| ",
  ],
  translation: [
    "laṅghanaṁ svēdanaṁ kālō yavāgvastiktakō rasaḥ||142||",
    "pācanānyavipakvānāṁ dōṣāṇāṁ taruṇē jvarē|143|",
  ],
  meaning:
    "Langhana (fasting), swedana (fomentation), kala (waiting period of eight days), yavagu (medicated gruels) and tikta rasa drugs (drugs having bitter taste) and all digestive enhancers of avipakva dosha (untransformed) are prescribed in the taruna jwara (the initial stage of jwara).[142]",
  audioFiles: {
    full: "/audio/Taruna_Jwara_Full.mp3",
    lines: [
      "/audio/Navajwara_Part_1.mp3",
      "/audio/Navajwara_Part_2.mp3",
    ],
  },
};

const ShlokaDesc = () => {
  const [activeLine, setActiveLine] = useState(0);
  const [linesCount, setLinesCount] = useState(shlokaData.text.length);
  // const [isPlaying, setIsPlaying] = useState(false);
  const [repetitionCount, setRepetitionCount] = useState(1);
  const [initialized, setInitialized] = useState(false);
  const [playingFullShloka, setPlayingFullShloka] = useState(false);

  // const fullAudioRef = useRef(null);
  const lineAudioRefs = useRef(
    shlokaData.audioFiles.lines.map(() => React.createRef())
  );

  const MAX_REPETITIONS = 2;
  const fullAudioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLinePlaying, setIsLinePlaying] = useState(false);

  const playFullAudio = () => {
    console.log("Playing full audio");

    if (fullAudioRef.current) {
      if (isPlaying) {
        fullAudioRef.current.pause();
        setIsPlaying(false);
      } else {
        setPlayingFullShloka(true);
        setIsPlaying(true);
        fullAudioRef.current.play();
      }
    }
  };


  const playLineAudio = (index) => {
    console.log("Playing line audio", index);
    setPlayingFullShloka(false);

    const currentAudio = lineAudioRefs.current[index].current;
    if (currentAudio) {
        // Reset repetition count if switching lines
        if (activeLine !== index) {
            setRepetitionCount(0);
            setActiveLine(index);
        }

        if (isLinePlaying) {
            currentAudio.pause();
            setIsLinePlaying(false);
        } else {
            currentAudio.play();
            setIsLinePlaying(true);

            currentAudio.onended = () => {
                if (repetitionCount < MAX_REPETITIONS - 1) {
                    // Repeat the same line
                    setRepetitionCount(repetitionCount + 1);
                    currentAudio.currentTime = 0;
                    currentAudio.play();
                } else {
                    // Move to the next line
                    setRepetitionCount(0);
                    setIsLinePlaying(false);

                    if (index < shlokaData.audioFiles.lines.length - 1) {
                        setActiveLine(index + 1);
                        playLineAudio(index + 1);
                    }
                }
            };
        }
    }
};


  return (
    <div className="p-10">
      <p>Back to all shlokas</p>
      <div className="grid md:grid-cols-6 gap-4">
        {/* Right Side */}
        <div className="col-span-4 space-y-4">
          {/* Shloka Heading */}
          <div className="relative flex flex-col items-center w-full">
            {/* Image & Text */}
            <div className="h-64 w-full flex justify-center z-5">
              {/* Black overlay */}
              <div className="black-overlay rounded-lg"></div>
              {/* Image */}
              <Image
                src={"/images/shloka_img_2.jpg"}
                alt="Shloka"
                width={1400}
                height={240}
                className="rounded-lg w-full object-cover h-full"
              />
              <div className=" flex items-center justify-between absolute bottom-4 left-3 text-left w-full text-white">
                <div>
                  <h1 className="text-2xl">
                    Nava Jwara or Taruna Jwara Chikitsa
                  </h1>
                  <p className="text-xs">
                    Guiding the Early Healing of Fever through Detox and
                    Lightness
                  </p>
                </div>
                <Heart size={18} className="absolute right-6 bottom-1" />
              </div>
            </div>
          </div>


          {/*  shloka  */}
          <div className="bg-white p-3 text-center place-items-center space-y-2 w-full">
            
            <ShlokaDisplay
              activeLine={activeLine}
              shlokaData={shlokaData}
              playingFullShloka={playingFullShloka}
              linesCount={linesCount}
              repetitionCount={repetitionCount}
            />
            {/* Play */}
            <button onClick={playFullAudio} className="cursor-pointer bg-indigo-100/50 text-black/40 hover:text-black hover:bg-green-100 px-5 py-1 rounded-2xl">
              {isPlaying ? "Pause Full Audio" : "Play Full Audio"}
            </button>
            <audio ref={fullAudioRef} src={shlokaData.audioFiles.full} />
          </div>

          {/* Pause - Play - Next */}
          <div className="bg-white/50 hover:bg-white p-10 space-y-5">
            <div className="flex justify-center items-center space-x-4">
              <MdOutlineSkipPrevious
                onClick={() => {
                    if (activeLine > 0) {
                        setActiveLine(activeLine - 1);
                        setRepetitionCount(0);
                        playLineAudio(activeLine - 1);
                    }
                }}
                size={28}
                className="cursor-pointer bg-indigo-100/40 text-black/40 hover:text-black hover:bg-indigo-100 p-1 rounded-2xl"
              />
            {
                isLinePlaying ? (
                    <CiPause1 
                    onClick={() => {
                        const currentAudio = lineAudioRefs.current[activeLine].current;
                        if (currentAudio) {
                        currentAudio.pause();
                        setIsLinePlaying(false);
                        }
                    }}
                    size={28}
                    className="cursor-pointer bg-green-100/50 text-black/40 hover:text-black hover:bg-green-100 p-1 rounded-2xl"
                    />
                ) : ( 
                    <MdPlayArrow
                    onClick={() => playLineAudio(activeLine)}
                    size={28}
                    className="cursor-pointer bg-green-100/50 text-black/40 hover:text-black hover:bg-green-100 p-1 rounded-2xl"
                    />
                )
            }

             
              <audio ref={lineAudioRefs.current[activeLine]} src={shlokaData.audioFiles.lines[activeLine]} />

              <MdSkipNext
                onClick={() => {
                    if (activeLine < shlokaData.audioFiles.lines.length - 1) {
                        setActiveLine(activeLine + 1);
                        setRepetitionCount(0);
                        playLineAudio(activeLine + 1);
                    }
                }}  
                    
                size={28}
                className="cursor-pointer bg-indigo-100/40 text-black/40 hover:text-black hover:bg-indigo-100 p-1 rounded-2xl"
              />
              <BiHide
                size={28}
                className="cursor-pointer bg-red-100/50 text-black/40 hover:text-black hover:bg-red-100 p-1 rounded-2xl"
              />
            </div>
            <div className="bg-grey-50 h-1"></div>
          </div>
        </div>

        {/* Left Side */}
        <div className="col-span-2 space-y-5">
          <div className="bg-indigo-50 p-4 rounded-lg">
            <h2 className="text-xl text-brown">Meaning</h2>
            <p className="text-sm">
              In the early stage of jwara (fever), known as taruna jwara, the
              treatment includes:
            </p>
            <ul className="text-sm">
              <li>Langhana (fasting)</li>
              <li>Swedana (fomentation/sudation)</li>
              <li> Kala (a waiting period, typically eight days)</li>
              <li>Yavagu (medicated gruels)</li>
              <li>Use of Tikta rasa (bitter-tasting herbs)</li>
              <li>
                Digestive stimulants to process avipakva doshas (undigested or
                unripe doshas)
              </li>
              <li>
                This approach aims to support the natural resolution of fever by
                enhancing digestion and aiding in dosha transformation.
              </li>
            </ul>
            <p className="text-sm">
              This approach aims to support the natural resolution of fever by
              enhancing digestion and aiding in dosha transformation
            </p>
          </div>
          <div className="bg-white/60 p-4 rounded-lg">
            <h5 className="text-brown">Lines:</h5>
            <p className="">लङ्घनं स्वेदनं कालो यवाग्वस्तिक्तको रसः||१४२||</p>
            <p className="text-sm text-gray-400">
              पाचनान्यविपक्वानां दोषाणां तरुणे ज्वरे|१४३|
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShlokaDesc;
