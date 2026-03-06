const { createWorker } = require("tesseract.js");
(async () => {
  const worker = await createWorker("eng");
  const ret = await worker.recognize("captcha1.jpeg");
  const ret2 = await worker.recognize(
    "https://sports.ssmmtt.com/web-root/public/captcha.aspx?key=captcha-place-bet",
  );
  console.log(ret.data.text);
  console.log(ret2.data.text);
  await worker.terminate();
})();

//winbox sbo captcha url
//https://sports.ssmmtt.com/web-root/public/captcha.aspx?key=captcha-place-bet
