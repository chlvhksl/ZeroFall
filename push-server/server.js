const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어
app.use(cors());
app.use(express.json());

// 토큰 저장소 (실제로는 데이터베이스 사용 권장)
const TOKENS_FILE = path.join(__dirname, 'tokens.json');
let userTokens = [];

// 토큰 파일 로드
function loadTokens() {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const data = fs.readFileSync(TOKENS_FILE, 'utf8');
      userTokens = JSON.parse(data);
    }
  } catch (error) {
    console.error('토큰 파일 로드 실패:', error);
    userTokens = [];
  }
}

// 토큰 파일 저장
function saveTokens() {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(userTokens, null, 2));
  } catch (error) {
    console.error('토큰 파일 저장 실패:', error);
  }
}

// 앱 시작 시 토큰 로드
loadTokens();

// 푸시 알림 발송 함수
async function sendPushNotification(token, title, body, data = {}) {
  try {
    // 시뮬레이터 토큰 체크
    if (token.startsWith('simulator-token-')) {
      console.log('⚠️ 시뮬레이터 토큰 감지 - 푸시 알림 발송 건너뜀');
      return {
        success: false,
        message: '시뮬레이터에서는 실제 푸시 알림을 발송할 수 없습니다.',
        token: token,
      };
    }

    const message = {
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: data,
    };

    console.log('푸시 알림 발송:', message);

    const response = await axios.post(
      'https://exp.host/--/api/v2/push/send',
      message,
      {
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
      },
    );

    console.log('푸시 알림 발송 결과:', response.data);
    return response.data;
  } catch (error) {
    console.error(
      '푸시 알림 발송 실패:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// 토큰 등록 API
app.post('/api/register-token', (req, res) => {
  try {
    const { token, userId, platform } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: '토큰이 필요합니다.',
      });
    }

    // 기존 토큰 제거 (중복 방지)
    userTokens = userTokens.filter(t => t.token !== token);

    // 새 토큰 추가
    const tokenData = {
      token: token,
      userId: userId || 'anonymous',
      platform: platform || 'unknown',
      registeredAt: new Date().toISOString(),
    };

    userTokens.push(tokenData);
    saveTokens();

    console.log(`✅ 토큰 등록: ${token.substring(0, 20)}...`);
    console.log(`📊 총 등록된 토큰: ${userTokens.length}개`);

    res.json({
      success: true,
      message: '토큰이 등록되었습니다.',
      totalTokens: userTokens.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '토큰 등록 실패',
      error: error.message,
    });
  }
});

// 푸시 알림 발송 API
app.post('/api/send-push', async (req, res) => {
  try {
    const { token, title, body, data } = req.body;

    if (!token || !title || !body) {
      return res.status(400).json({
        success: false,
        message: '토큰, 제목, 내용은 필수입니다.',
      });
    }

    const result = await sendPushNotification(token, title, body, data);

    res.json({
      success: true,
      message: '푸시 알림이 발송되었습니다.',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '푸시 알림 발송 실패',
      error: error.message,
    });
  }
});

// 모든 사용자에게 푸시 알림 발송
app.post('/api/broadcast-push', async (req, res) => {
  try {
    const { title, body, data } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: '제목과 내용은 필수입니다.',
      });
    }

    if (userTokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: '등록된 토큰이 없습니다.',
        totalTokens: 0,
      });
    }

    console.log(`📢 모든 사용자에게 푸시 발송 시작 (${userTokens.length}명)`);

    const results = [];
    let successCount = 0;
    let failCount = 0;

    // 모든 토큰에 순차적으로 푸시 발송
    for (const tokenData of userTokens) {
      try {
        const result = await sendPushNotification(
          tokenData.token,
          title,
          body,
          { ...data, broadcast: true, timestamp: Date.now() },
        );

        if (result.success !== false) {
          successCount++;
        } else {
          failCount++;
        }

        results.push({
          token: tokenData.token.substring(0, 20) + '...',
          platform: tokenData.platform,
          success: result.success !== false,
        });
      } catch (error) {
        failCount++;
        results.push({
          token: tokenData.token.substring(0, 20) + '...',
          platform: tokenData.platform,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(
      `📊 푸시 발송 완료: 성공 ${successCount}개, 실패 ${failCount}개`,
    );

    res.json({
      success: true,
      message: `모든 사용자에게 푸시 알림을 발송했습니다.`,
      totalTokens: userTokens.length,
      successCount: successCount,
      failCount: failCount,
      results: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '전체 푸시 발송 실패',
      error: error.message,
    });
  }
});

// 등록된 토큰 목록 조회
app.get('/api/tokens', (req, res) => {
  res.json({
    success: true,
    totalTokens: userTokens.length,
    tokens: userTokens.map(t => ({
      token: t.token.substring(0, 20) + '...',
      platform: t.platform,
      userId: t.userId,
      registeredAt: t.registeredAt,
    })),
  });
});

// 테스트용 푸시 알림 발송
app.post('/api/test-push', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: '토큰이 필요합니다.',
      });
    }

    const testData = {
      timestamp: Date.now(),
      type: 'test',
      from: 'ZeroFall Server',
    };

    const result = await sendPushNotification(
      token,
      '🧪 테스트 푸시 알림',
      'Express 서버에서 발송한 테스트 알림입니다!',
      testData,
    );

    res.json({
      success: true,
      message: '테스트 푸시 알림이 발송되었습니다.',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '테스트 푸시 알림 발송 실패',
      error: error.message,
    });
  }
});

// 서버 상태 확인
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'ZeroFall 푸시 서버가 정상 작동 중입니다.',
    timestamp: new Date().toISOString(),
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 ZeroFall 푸시 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📱 테스트 URL: http://localhost:${PORT}/api/health`);
});
