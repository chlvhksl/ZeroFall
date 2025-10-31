/**
 * http_proxy_server.js - Metro 번들러용 스텁 모듈
 * 
 * 이 파일은 React Native Metro 번들러가 http_proxy_server 모듈을 찾을 때
 * 오류를 발생시키지 않도록 하는 빈 스텁 모듈입니다.
 * 
 * 실제 프록시 서버는 arduino/http_proxy_server.js에 있으며,
 * 이는 Node.js 서버 전용이므로 React Native 앱에서는 사용되지 않습니다.
 */
module.exports = {};

// TypeScript 타입 정의를 위한 export
if (typeof module !== 'undefined' && module.exports) {
  module.exports.default = module.exports;
}

