/* global Express */
import { S3Client, DeleteObjectCommand, ObjectCannedACL,S3ClientConfig } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import path from 'path';
import fs from 'fs';
import httpStatus from 'http-status';
import ApiError from '../errors/ApiErrors';
import config from '../config';

const s3Config: S3ClientConfig = {
  endpoint: config.do_space.endpoints,
  region: config.do_space.region || "us-east-1",
  credentials: {
    accessKeyId: config.do_space.access_key || "",
    secretAccessKey: config.do_space.secret_key || "",
  },
  forcePathStyle: true, 
};
 
const s3 = new S3Client(s3Config);
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
 
export const uploadToDigitalOcean = async (file: Express.Multer.File): Promise<string> => {
  try {
    if (!file) throw new ApiError(400, "No file provided");
 
    if (file.size > MAX_FILE_SIZE) {
      throw new ApiError(
        400,
        `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }
 
    const mimeType = file.mimetype || "application/octet-stream";
    const fileExtension = path.extname(file.originalname) || "";
    const fileName = `uploads/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 15)}${fileExtension}`;
 
    const uploadParams = {
      Bucket: config.do_space.bucket,
      Key: fileName,
      Body: fs.createReadStream(file.path),
      ACL: "public-read" as ObjectCannedACL, // optional
      ContentType: mimeType,
    };
 
    const upload = new Upload({ client: s3, params: uploadParams });
    const data = await upload.done();
 
    // Delete temp file after upload
    fs.unlink(file.path, (err) => {
      if (err) console.error("Failed to delete temp file:", err);
    });
 
    const fileUrlRaw =
      data.Location || `${config.do_space.endpoints}/${config.do_space.bucket}/${fileName}`;
    return fileUrlRaw.startsWith("http") ? fileUrlRaw : `https://${fileUrlRaw}`;
  } catch (error) {
    console.log(error, "check error");
    throw new ApiError(
      500,
      error instanceof Error
        ? `Failed to upload file: ${error.message}`
        : "Failed to upload file to MinIO"
    );
  }
};


/**
 * Deletes a file from DigitalOcean Space / MinIO by its public URL
 * @param fileUrl Public URL of the file
 */
export const deleteFromDigitalOcean = async (fileUrl: string): Promise<void> => {
  try {
    if (!fileUrl) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'File URL is required');
    }

    // Extract the key from the URL
    let cleanUrl = fileUrl.replace(/^https?:\/\//, '');

    // Remove port if exists (like :443)
    const endpointHost = (config.do_space.endpoints || '').replace(/^https?:\/\//, '').replace(/:\d+$/, '');

    // Remove endpoint host
    if (endpointHost && cleanUrl.startsWith(endpointHost)) {
      cleanUrl = cleanUrl.replace(endpointHost, '');
    }

    // Ensure leading slash removed
    cleanUrl = cleanUrl.replace(/^\//, '');

    // Remove bucket name prefix
    if (config.do_space.bucket && cleanUrl.startsWith(config.do_space.bucket + '/')) {
      cleanUrl = cleanUrl.replace(config.do_space.bucket + '/', '');
    }

    const key = cleanUrl;

    if (!key) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Could not extract object key from file URL');
    }

    await s3.send(
      new DeleteObjectCommand({
        Bucket: config.do_space.bucket || '',
        Key: key,
      })
    );

    console.log('Deleted successfully from space:', key);
  } catch (error) {
    console.error('File deletion failed:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error instanceof Error ? `Failed to delete file: ${error.message}` : 'Failed to delete file from Space'
    );
  }
};

/**
 * Uploads a base64 image to DigitalOcean Space / MinIO
 * @param base64Str base64 data URL string (e.g. data:image/png;base64,...)
 */
export const uploadBase64ToDigitalOcean = async (base64Str: string): Promise<string> => {
  const matches = base64Str.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid base64 image format');
  }

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const fileExtension = mimeType.split('/')[1] === 'jpeg' ? '.jpg' : `.${mimeType.split('/')[1] || 'png'}`;
  
  const file = {
    buffer,
    mimetype: mimeType,
    originalname: `review-upload-${Date.now()}-${Math.floor(Math.random() * 1000)}${fileExtension}`,
    size: buffer.length,
  } as Express.Multer.File;

  return uploadToDigitalOcean(file);
};

