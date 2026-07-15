import type { Request } from 'express';

type MulterFile = {
  mimetype: string;
  size: number;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
export const fileFilter = (
  req: Request,
  file: MulterFile,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  cb: (_err: Error | null, _ok: boolean) => void,
) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "image/webp",
    "audio/mpeg",
    "video/mp4",
  ];

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    file.mimetype.startsWith("image/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};
