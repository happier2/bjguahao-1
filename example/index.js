const bjguahao = require('..');
const fs = require("fs");
const config = require('./config');
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

const doctorWeight = {
  '知名专家': 1,
  '专家': 2,
  '主任医师': 3,
  '副主任医师': 4,
  '普通门诊': 5,
}


const printDoctors = function (zeroCode, doctors) {
  console.log('-----------------------------------上午-----------------------------------');
  doctors.data[0].detail.forEach(doctor => {
    console.log(` - ${doctor.doctorName}(${doctor.doctorTitleName}) ${doctor.skill} ${doctor.uniqProductKey} ${doctor.ncode !== zeroCode ? '有' : '无'}号`);
  });
  console.log('-----------------------------------下午-----------------------------------');
  doctors.data[1].detail.forEach(doctor => {
    console.log(` - ${doctor.doctorName}(${doctor.doctorTitleName}) ${doctor.skill} ${doctor.uniqProductKey} ${doctor.ncode !== zeroCode ? '有' : '无'}号`);
  });
}

const findZeroCode = function (doctor) {
  const fcode = doctor.fcode; //"&#xf15e;&#xf128;&#xf128;";
  const lastIndex = fcode.lastIndexOf('&');
  const zeroCode = fcode.substr(lastIndex, 8);
  return zeroCode;
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
  const {
    mobile,
    hosCode,
    firstDeptCode,
    secondDeptCode,
    target,
    patientName,
    doctorNames,
  } = config;

  console.log(`患者姓名: ${patientName}, 日期: ${target}, 候选医生: ${JSON.stringify(doctorNames)}`);

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

  // const calendar = await bjguahao.calendar(session, calnederPayload);

  const doctorDetailPayload = {
    firstDeptCode,
    hosCode,
    secondDeptCode,
    target,
  }

  let uniqProductKey = '';
  while (true) {
    console.log('开始查询当天数据...')
    let doctors = await bjguahao.doctors(session, doctorDetailPayload);
    let firstDoctor = doctors.data[0].detail[0] || doctors.data[1].detail[0];
    let zeroCode = findZeroCode(firstDoctor);
    console.log(zeroCode);
    printDoctors(zeroCode, doctors);
    do {
      const availableDoctors = [];
      doctors.data[0].detail.forEach(doctor => {
        if (doctor.ncode !== zeroCode) {
          availableDoctors.push({
            ...doctor,
            ampm: 0,
          });
        }
      });
      doctors.data[1].detail.forEach(doctor => {
        if (doctor.ncode !== zeroCode) {
          availableDoctors.push({
            ...doctor,
            ampm: 1,
          });
        }
      });
      if (availableDoctors.length !== 0) {
        availableDoctors.sort((a, b) => {
          return doctorWeight[a.doctorTitleName] - doctorWeight[b.doctorTitleName]
        })
        // console.log(JSON.stringify(availableDoctors));
        const foundDoctor = availableDoctors.find(doctor => {
          return doctorNames.indexOf(doctor.doctorName) > -1;
        }) || availableDoctors[0];
        uniqProductKey = foundDoctor.uniqProductKey;
        console.log(`${foundDoctor.doctorName} ${foundDoctor.doctorTitleName} ${uniqProductKey}`);
        break;
      } else {
        console.log('sleep 1 second');
        await sleep(1);
        doctors = await bjguahao.doctors(session, doctorDetailPayload);
        firstDoctor = doctors.data[0].detail[0] || doctors.data[1].detail[0];;
        zeroCode = findZeroCode(firstDoctor);
        // console.log(zeroCode);
      }
    } while (true);

    const patients = await bjguahao.patients(session);
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

    try {
      const result = await bjguahao.submit(session, savePayload);
      console.log(`挂号成功! 订单号: ${result.data.orderNo}`);
      break;
    } catch (error) {
      console.log(`挂号失败, 错误码: ${error.code}，错误描述: ${error.message}`)
    }
  }
})();