import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Create uploads folder if not exists
const uploadDir = path.join(os.tmpdir(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // save temporarily to /uploads
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 400 * 1024 * 1024 }, // 400MB
});

// Upload handlers
export const fileUploader = {
  profileImage: upload.single('profileImage'),
  profileImages: upload.array('profileImages', 10),

  faceVerification: upload.fields([
    { name: 'profileImg', maxCount: 1 },
    { name: 'selfieImg', maxCount: 1 },
  ]),


  

  uploadMemory: upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'coverPhoto', maxCount: 1 },
    { name: 'photos', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
  ]),
  userImages: upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
  ]),
  serviceProviderDocuments: upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
  ]),
  chatImages: upload.single('chatImage'),
  postImage: upload.single('image'),
};
