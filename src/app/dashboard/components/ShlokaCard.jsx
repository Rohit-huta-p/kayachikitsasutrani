"use client";
import React from "react";
import Image from "next/image";
import { Custom_Link } from "@/components/Link";

const ShlokaCard = ({ shloka }) => {
  const imgSrc = shloka.image?.url || "/images/shloka_img_2.jpg";
  return (
    <div className="rounded-lg shadow-lg hover:shadow-xl transition-shadow">
      <div className="h-46 overflow-hidden">
        <Image
          src={imgSrc}
          alt={shloka.title}
          width={300}
          height={120}
          className="rounded-md w-full object-cover h-full"
        />
      </div>

      <div className="p-3 bg-white rounded-b-lg space-y-2">
        <h4 className="mt-2 text-lg font-semibold text-gray-800">
          <Custom_Link href={`/shloka/${shloka.slug}`}>
            #{shloka.title}
          </Custom_Link>
        </h4>
        <p className="text-sm text-brown font-thin">{shloka.meaning}</p>
      </div>
    </div>
  );
};

export default ShlokaCard;
