declare module 'react-native-html-parser' {
    export class DOMParser {
      parseFromString(html: string, mimeType: string): Document;
    }
  }