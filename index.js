const http = require('https');
const assert = require('assert');
const crypto = require('crypto-js');
const qs = require('querystring');
const HttpsProxyAgent = require('https-proxy-agent');

const ERROR_CODES = {
  812: '短信发送太频繁',
  817: '抱歉，短信验证码发送次数已达到今日上限！',
  7001: '短信验证码错误!',
  8010: '号源不足！',
  8019: '超过停挂时间！',
};

const request = (method, url, payload, rawHeaders) => {
  const proxy = 'http://127.0.0.1:8888';
  const agent = new HttpsProxyAgent(proxy);
  const headers = {
    ...rawHeaders,
    'Origin': 'https://www.114yygh.com',
    'Referer': 'https://www.114yygh.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36',
    'Request-Source': 'PC',
  }
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method,
      headers,
      agent,
    }, resolve);
    req.once('error', reject);
    req.end(payload);
  });
};

const get = (url, headers) =>
  request('get', url, null, headers);

const post = (url, payload, headers) =>
  request('post', url, JSON.stringify(payload), Object.assign({
    'Content-Type': 'application/json;charset=UTF-8',
  }, headers));

const readStream = stream => {
  const buffer = [];
  return new Promise((resolve, reject) => {
    stream
      .on('error', reject)
      .on('data', chunk => buffer.push(chunk))
      .on('end', () => resolve(Buffer.concat(buffer)))
  });
};

const handleError = res => {
  if (res.resCode !== 0) {
    const err = new Error(res.msg);
    err.code = res.resCode;
    err.response = res;
    err.data = res.data;
    throw err;
  }
  return res;
};

const ensureStatusCode = expected => res => {
  const { statusCode } = res;
  assert.equal(statusCode, expected, `status code must be "${expected}" but actually "${statusCode}"`);
  return res;
};

const encrypt = str => {
  const key = crypto.enc.Utf8.parse("hyde2019hyde2019");
  const data = crypto.enc.Utf8.parse(str);
  return crypto.AES.encrypt(data, key, {
    mode: crypto.mode.ECB,
    padding: crypto.pad.Pkcs7
  }).toString();
};

const verifyCode = (cookie, payload) => {
  var newCookie = '';
  return Promise
    .resolve()
    .then(() => get(`${bjguahao.api}/web/common/verify-code/get?_time=${new Date().getTime()}&${qs.stringify(payload)}`, { cookie }))
    .then(ensureStatusCode(200))
    .then(res => {
      newCookie = res.headers['set-cookie'];
      return res;
    })
    .then(readStream)
    .then(JSON.parse)
    .then(body => {
      assert.equal(body.resCode, 0, body.msg);
      return body;
    })
    .then(() => newCookie.map(x => x.split(/;\s?/)[0]))
    .then(cookies => cookies.join('; '))
};

const login = (session, mobileNo, smsCode) => {
  const payload = {
    mobile: encrypt(mobileNo),
    code: encrypt(smsCode),
    // loginType: 'PASSWORD_LOGIN',
  };
  var cookie = '';
  return Promise
    .resolve()
    .then(() => post(`${bjguahao.api}/web/login?_time=${new Date().getTime()}`, payload, { cookie: session }))
    .then(ensureStatusCode(200))
    .then(res => {
      cookie = res.headers['set-cookie'];
      return res;
    })
    .then(readStream)
    .then(JSON.parse)
    .then(body => {
      assert.equal(body.resCode, 0, body.msg);
      return body;
    })
    .then(() => cookie.map(x => x.split(/;\s?/)[0]))
    .then(cookies => cookies.join('; '))
};

const calendar = (cookie, payload) => {
  return Promise
    .resolve()
    .then(() => post(`${bjguahao.api}/web/product/list?_time=${new Date().getTime()}`, payload, { cookie }))
    .then(readStream)
    .then(JSON.parse)
    .then(handleError)
};

const getDoctors = (cookie, payload) => {
  return Promise
    .resolve()
    .then(() => post(`${bjguahao.api}/web/product/detail?_time=${new Date().getTime()}`, payload, { cookie }))
    .then(ensureStatusCode(200))
    .then(readStream)
    .then(JSON.parse)
    .then(handleError)
};

const getPatients = (cookie) => {
  return Promise
    .resolve()
    .then(() => get(`${bjguahao.api}/web/patient/list?_time=${new Date().getTime()}&showType=ORDER_CONFIRM`, { cookie }))
    .then(ensureStatusCode(200))
    .then(readStream)
    .then(JSON.parse)
    .then(handleError)
};

const status = (cookie) => {
  return Promise
    .resolve()
    .then(() => get(`${bjguahao.api}/web/user/real-name/status?_time=${new Date().getTime()}`, { cookie }))
    .then(ensureStatusCode(200))
    .then(readStream)
    .then(JSON.parse)
  // .then(handleError)
};


const submit = (cookie, payload) => {
  return Promise
    .resolve()
    .then(() => post(`${bjguahao.api}/web/order/save?_time=${new Date().getTime()}`, payload, { cookie }))
    .then(ensureStatusCode(200))
    .then(readStream)
    .then(JSON.parse)
    .then(handleError)
};

const bjguahao = {};
bjguahao.login = login;
bjguahao.request = request;
bjguahao.doctors = getDoctors;
bjguahao.patients = getPatients;
bjguahao.calendar = calendar;
bjguahao.verifyCode = verifyCode;
bjguahao.submit = submit;
bjguahao.status = status;
bjguahao.api = 'https://www.114yygh.com';

module.exports = bjguahao;