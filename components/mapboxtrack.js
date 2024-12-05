var randomstring = require("randomstring");

export function generateIdempotency() {
  return `${Date.now()}${randomstring.generate({
    length: 24,
    charset: "alphanumeric",
    capitalization: "lowercase",
  })}`;
}

export function generateIdempotencyShort() {
  return `${Date.now()}${randomstring.generate({
    length: 6,
    charset: "alphanumeric",
    capitalization: "lowercase",
  })}`;
}

var sessionid = generateIdempotency();
var initDate = Date.now();


export function signintrack(email, name) {
  fetch("https://alphacentauri.lacontroller.io/signin", {
    mode: "cors",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify({
      sessionid: sessionid,
      email: email,
      name: name,
    }),
  });
}

export function uploadMapboxTrack(options) {
  var calctimesincestart = Date.now() - initDate;

  //requests from https://helianthus.mejiaforcontroller.com/
  fetch("https://alphacentauri.lacontroller.io/mapbox", {
    mode: "cors",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify({
      sessionid: sessionid,
      eventid: generateIdempotencyShort(),
      mapname: "311",
      eventtype: options.eventtype,
      timesincestart: calctimesincestart,
      globallat: options.globallat,
      globallng: options.globallng,
      globalzoom: options.globalzoom,
      mouselat: options.mouselat,
      mouselng: options.mouselng,
    }),
  })
    .then((info) => {
      console.log(info);
    })
    .catch((error) => {
      console.error(error);
    });
}
