import { Injectable } from '@angular/core';
import {
  Camera,
  CameraResultType,
  CameraSource,
  Photo,
} from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';


@Injectable({
  providedIn: 'root',
})

export class PhotoService {

  public photos: UserPhoto[] = [];
  private PHOTO_STORAGE: string = 'photosGallery';

  constructor(private platform: Platform) {}

  public async addNewToGallery() {
  // Take a photo
  const capturedPhoto = await Camera.getPhoto({
    resultType: CameraResultType.Uri, // file-based data; provides best performance
    source: CameraSource.Camera, // automatically take a new photo with the camera
    quality: 100 // highest quality (0 to 100)
  });

  // Save the picture and add it to photo collection
  const savedImageFile = await this.savePicture(capturedPhoto);
  if (savedImageFile) {
    this.photos.unshift(savedImageFile);
  }

  Preferences.set({
    key: this.PHOTO_STORAGE,
    value: JSON.stringify(this.photos),
  });
}

  // Save picture to file on device
  private async savePicture(photo: Photo) {
    // Convert photo to base64 format, required by Filesystem API to save
    const base64Data = await this.readAsBase64(photo);

    if(base64Data){
    // Write the file to the data directory
    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    });

    if (this.platform.is('hybrid')) {
      // Display the new image by rewriting the 'file://' path to HTTP
      // Details: https://ionicframework.com/docs/building/webview#file-protocol
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
      };
    }
    else {
      // Use webPath to display the new image instead of base64 since it's
      // already loaded into memory
      return {
        filepath: fileName,
        webviewPath: photo.webPath
      };
    }
  }
  return null;
}

  private async readAsBase64(photo: Photo) {
    let base64;
    try {
      // "hybrid" will detect Cordova or Capacitor
      if (this.platform.is('hybrid')) {
        if(typeof photo.path === "string"){
          // Read the file into base64 format
          const file = await Filesystem.readFile({
            path: photo.path
          });
          base64 = file.data;
        }else{
          throw new Error("photo path is not defined");
        }
      } else {
        if(typeof photo.webPath === "string"){
          // Fetch the photo, read as a blob, then convert to base64 format
          const response = await fetch(photo.webPath);
          if(!response.ok){
            throw new Error(response.statusText);
          }
          const blob = await response.blob();
          base64 = await this.convertBlobToBase64(blob) as string;
        }else{
          throw new Error("photo webPath is not defined");
        }
      }
    } catch (error) {
      console.log(`Error reading or converting file: ${error}`);
    }
    return base64;
  }

  private convertBlobToBase64 = (blob: Blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });

    public async loadSaved() {
      // Retrieve cached photo array data
      const photoList = await Preferences.get({ key: this.PHOTO_STORAGE });
      if (photoList.value != null) {
        try {
          this.photos = JSON.parse(photoList.value) || [];
        } catch (err) {
          console.log("Error parsing JSON:", err);
          this.photos = [];
        }
      }else {
          this.photos = [];
      }
    
      // Easiest way to detect when running on the web:
      // “when the platform is NOT hybrid, do this”
      if (!this.platform.is('hybrid')) {
        // Display the photo by reading into base64 format
        for (let photo of this.photos) {
          // Read each saved photo's data from the Filesystem
          const readFile = await Filesystem.readFile({
              path: photo.filepath,
              directory: Directory.Data
          });
    
          // Web platform only: Load the photo as base64 data
          photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
        }
      }
    }
  
}

export interface UserPhoto {
  filepath: string;
  webviewPath: string | undefined;
}
