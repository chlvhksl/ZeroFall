// declarations.d.ts 파일의 최종 권장 내용

// React Native에서 .png 파일을 ImageSourcePropType으로 인식하도록 정의
declare module '*.png' {
  import { ImageSourcePropType } from 'react-native';
  const value: ImageSourcePropType;
  export default value;
}

// .jpg 파일을 사용할 경우를 대비한 정의
declare module '*.jpg' {
  import { ImageSourcePropType } from 'react-native';
  const value: ImageSourcePropType;
  export default value;
}