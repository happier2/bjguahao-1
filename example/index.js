const bjguahao = require('..');
const fs = require("fs");
const { SSL_OP_COOKIE_EXCHANGE } = require('constants');

const input = prompt => new Promise((resolve, reject) => {
  process.stdout.write(prompt + ' ');
  process.stdin
    .once('error', reject)
    .once('data', line => resolve(`${line}`.trim()));
});

const sleep = function (t) {
  return new Promise(res => setTimeout(res, t))
}

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const utf8ToNumber = {
  '&#xf592;': 5,
  '&#xf764;': 7,
  '&#xf42b;': 0,
}

const datetime = (date, pattern) =>
  pattern.replace(/{(\w+)}/g, (_, name) => ({
    yyyy: date.getFullYear(),
    yy: date.getYear(),
    MM: date.getMonth() + 1,
    dd: date.getDate(),
    hh: date.getHours(),
    mm: date.getMinutes(),
    ss: date.getSeconds(),
  })[name] || `{${name}}`);

(async () => {


  const mobile = '13333333333';
  const hosCode = "142";
  const firstDeptCode = 'f8efd902e9f7048592ac0bc48d98c252'; //'76b059a760365aacb1a5ed0441128cab';
  const secondDeptCode = '200039608'; //"200039524";
  const target = '2020-08-25';
  const patientName = '王爱玲';

  let session = fs.readFileSync('cookie.txt').toString();

  const statusResult = await bjguahao.status(session);
  if (statusResult.resCode !== 0) {
    // const mobile = await input('phone:');
    const smsPayload = {
      mobile,
      smsKey: 'LOGIN'
    }
    session = await bjguahao.verifyCode(null, smsPayload);
    const smsCode = await input('sms-code:');
    session = await bjguahao.login(session, mobile, smsCode);
    console.log('after login session', session);
    fs.writeFileSync('cookie.txt', session);
  } else {
    console.log('cookie is not expired');
  }

  const calnederPayload = {
    firstDeptCode,
    hosCode,
    secondDeptCode,
    week: 1,
  };

  const calendar = await bjguahao.calendar(session, calnederPayload);
  // console.log(calendar);



  const doctorDetailPaylaod = {
    firstDeptCode,
    hosCode,
    secondDeptCode,
    target,
  }
  let uniqProductKey = '';
  while (true) {
    let zeroCode = '';
    console.log('开始查询当天数据...')
    const doctors = await bjguahao.doctors(session, doctorDetailPaylaod);
    console.log('上午');
    doctors.data[0].detail.forEach(doctor => {
      // console.log(doctor.fcode);
      const fcode = doctor.fcode; //"&#xf15e;&#xf128;&#xf128;";
      const lastIndex = fcode.lastIndexOf('&');
      zeroCode = doctor.fcode.substr(lastIndex,8);
      if (doctor.ncode !== zeroCode && uniqProductKey === '') {
        uniqProductKey = doctor.uniqProductKey;
      }
      console.log(` - ${doctor.doctorName}(${doctor.doctorTitleName}) ${doctor.skill} ${doctor.ncode !== zeroCode ? '有' : '无'}号`);
    });
    console.log('下午');
    doctors.data[1].detail.forEach(doctor => {
      console.log(` - ${doctor.doctorName}(${doctor.doctorTitleName}) ${doctor.skill} ${doctor.ncode !== zeroCode ? '有' : '无'}号`);
    });
    if (uniqProductKey !== '') {
      break;
    } else {
      console.log('sleep 1 second');
      await sleep(1);
    }
  }

  const patients = await bjguahao.patients(session);
  // console.log(patients);


  const patient = patients.data.list.find(item => item.patientName === patientName);

  const { phone, idCardType: cardType, idCardNo: cardNo } = patient;

  const smsPayload = {
    mobile: phone,
    smsKey: 'ORDER_CODE',
    uniqProductKey,
  }

  await bjguahao.verifyCode(session, smsPayload);
  const smsCode = await input('confirm sms-code:');

  const savePayload = {
    cardNo,
    cardType,
    dutyTime: 0,
    firstDeptCode,
    hosCode,
    hospitalCardId: "",
    orderFrom: "HOSP",
    phone: phone,
    secondDeptCode,
    smsCode,
    treatmentDay: target,
    uniqProductKey,
  }

  const result = await bjguahao.submit(session, savePayload);
  console.log('挂号成功: ', result.data.orderNo);
})();