import type { MetadataRoute } from "next";
import { seoCopy } from "@/lib/seo-copy";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AXE PRIME",
    short_name: "AXE PRIME",
    description: seoCopy.manifestDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#04101c",
    theme_color: "#0ea5e9",
    icons: [
      {
        src: "/brand/axe-prime-emblem.png",
        sizes: "210x240",
        type: "image/png",
      },
    ],
  };
}
