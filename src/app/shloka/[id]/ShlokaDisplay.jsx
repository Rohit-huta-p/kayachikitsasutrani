"use client";
import { Heart } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import React, { useState } from "react";

// ICONS
import { MdOutlineSkipPrevious, MdPlayArrow } from "react-icons/md";
import { MdSkipNext } from "react-icons/md";
import { CiPause1 } from "react-icons/ci";
import { BiHide } from "react-icons/bi";

import FullText from "./components/FullText";
import FullTranslation from "./components/FullTranslation";

const ShlokaDisplay = ({ shlokaData, playingFullShloka, activeLine, linesCount, repetitionCount }) => {
  return (
      <div className="bg-white p-3 text-center place-items-center space-y-2 w-full">
        {/* Full Text */}
        {playingFullShloka && (
          <div>
            <FullText shlokaData={shlokaData} />
            <FullTranslation shlokaData={shlokaData} />
          </div>
        )}

        {!playingFullShloka &&
          shlokaData.text.map((line, index) => {
            if (activeLine === index) {
              return (
                <>
                  <p
                    key={index}
                    className="text-2xl px-4 bg-primary-light-1 w-full"
                  >
                    {line}
                  </p>
                  <h3>{shlokaData.translation[index]}</h3>
                </>
              );
            }
          })}

        <p className='bg-grey-100 w-fit text-[10px] rounded-2xl px-2 '>
                        Line {activeLine +1} of {linesCount} · Repetition {repetitionCount} / 5
                    </p>
      </div>

  );
};

export default ShlokaDisplay;
