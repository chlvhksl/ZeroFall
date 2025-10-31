const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro configuration - 최소 설정
 * http_proxy_server 문제 해결: 루트에 stub 파일 존재
 */
const config = getDefaultConfig(__dirname);

// arduino 폴더만 블록
const projectRoot = __dirname;
const arduinoBlockRegex = new RegExp(
  require('path').join(projectRoot, 'arduino').replace(/\\/g, '/') + '/.*'
);

config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  arduinoBlockRegex,
  /.*[\/\\]arduino[\/\\].*/,
  /arduino\/.*/,
];

module.exports = config;
