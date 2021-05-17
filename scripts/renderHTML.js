// @ts-check
'use strict';

// renderHTML.js
// 生成HTML文件

const fs = require("fs");
const path = require('path');


const date = new Date();
date.setDate(date.getDate() - 1);
const year = date.getFullYear().toString();
const month = (date.getMonth() + 1).toString().padStart(2, '0');
const day = date.getDate().toString().padStart(2, '0');
const dateString = `${year}-${month}-${day}`;


const XinwenLianbo = fs.readFileSync('./abstract-XinwenLianbo.txt', "utf8");
const guancha = fs.readFileSync('./abstract-guancha.txt', "utf8");
const PeopleDaily = fs.readFileSync('./abstract-PeopleDaily.txt', "utf8");


const htmlString = `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>中文新闻</title>
</head>

<body>
  <h1>${dateString}</h1>${XinwenLianbo}${PeopleDaily}${guancha}
</body>
</html>
`;


// html文件夹留档
fs.writeFileSync(`../html/${dateString}-中文媒体.html`, htmlString, "utf8");



// 项目文件夹中创建 index.html 作为首页
// 把同一日期的所有 .html 文件的文件名和路径记录下来，然后写入 index.html 作为首页

let ulString = `<ul>`;
fs.readdirSync(`../html/`)
  .filter(fileName => fileName.startsWith(dateString))
  .sort().reverse()
  .map(fileName => path.join(`./html/`, fileName))
  .forEach(filePath => {
    console.log(filePath);
    const media = filePath.split(dateString + '-')[1].replace('.html', '');
    const liString = `<li><a href='${filePath}'>${media}</a></li>`;
    ulString = ulString + liString;
  });
ulString = ulString + '</ul>';

const indexString = `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>每日新闻集萃</title>
  <style>
    li {
      font-size: 1.25em;
    }
  </style>
</head>

<body>

  <h1>昨日新闻集萃: ${dateString}</h1>${ulString}

  </body>
</html>
`;

fs.writeFileSync('../index.html', indexString, "utf8");