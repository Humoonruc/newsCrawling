// XinwenLianbo.js
// @ts-check
'use strict';


const fs = require("fs");
const puppeteer = require('puppeteer');
const { MongoClient } = require("mongodb");
const sqliteClient = require('better-sqlite3');


// config
const timeSpan = 1; // 共抓取的天数
main();


async function main() {
  const recentItems = await crawlRecentNews(timeSpan);
  saveData(recentItems);
}


/**
 * crawlRecentNews(timeSpan) 抓取新闻联播条目，返回对象数组
 * @param timeSpan: 为一个整数，表明抓取最近多少天的内容
 */
async function crawlRecentNews(timeSpan) {

  // 启动 headless 浏览器
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1920, height: 1080, isMobile: false, },
  });
  let pages = await browser.pages();
  let currentPage = pages[0];


  // 函数内全局变量
  const crawlStartTime = Date.now(); // 程序运行计时器
  const XinwenLianbo = []; // 总容器
  const date = new Date(); // 当前时间对象


  //迭代日期抓取
  for (let i = 0; i < timeSpan; i++) {

    // 当日计时器
    const dailyStartTime = Date.now();


    // 由日期拼接url;
    date.setDate(date.getDate() - 1);
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    const url = 'https://tv.cctv.com/lm/xwlb/day/' + year + month + day + '.shtml';


    // 抓取详情页面的链接
    await currentPage.goto(url);
    const links = await currentPage.$$eval('li>a', nodes => nodes.map(node => node.getAttribute('href')));


    // 由链接进入详情页面，抓取全文并保存至容器
    const dailyItems = []; // 每日条目容器
    for (let j = 1; j < links.length; j++) {
      await currentPage.goto(links[j]);

      // 1. 抓取标题
      const title = await currentPage.$eval('h3', node => node.textContent.replace('[视频]', ''));
      console.log(dateString + ' ' + title);

      // 2. 抓取所有非空正文段落
      const paragraphs = await currentPage.$$eval(
        'div.cnt_bd>p',
        nodes => nodes
          .map(node => node.textContent.trim().replace('央视网消息（新闻联播）：', ''))
          .filter(text => text !== '')
        // 国内联播快讯和国际联播快讯页面的第一段，去掉"央视网消息（新闻联播）："后便是空字符串
      );

      // 3. 抓取独立成段的粗体小标题
      const subtitles = await currentPage.$$eval(
        'div.cnt_bd>p>strong',
        nodes => nodes.map(node => node.textContent.trim())
      );
      subtitles.shift(); // 除去“央视网消息”这一项，它并不是小标题

      // 4. 组织和保存 items
      if (subtitles.length === 0) {
        // 除了“央视网消息”，不含下一级小标题，整个页面实际上只有一个条目，push该条目即可
        const item = {
          date: dateString,
          listIndex: j,
          title: title,
          subtitle: '',
          link: links[j],
          content: paragraphs.join('\n'),
        };
        dailyItems.push(item);
      } else {
        // 除了“央视网消息”，还有下一级小标题，这个页面含有多个次级条目
        const simpleItems = splitBySubtitle(paragraphs, subtitles);
        simpleItems.forEach(simpleItem => {
          const item = {
            date: dateString,
            listIndex: j,
            title: title,
            subtitle: simpleItem.subtitle,
            link: links[j],
            content: simpleItem.content,
          };
          dailyItems.push(item);
        });
      }

      // 5. 每爬一个详情页面暂停0.1秒
      await currentPage.waitForTimeout(100);
    }


    // 添加结果到本次抓取的总容器中
    dailyItems.map((item, i) => {
      item.number = i + 1; // 增加一个 number 属性作为排序依据
      return item;
    }).forEach(item => XinwenLianbo.push(item));


    // 计算每日抓取耗时
    console.log(`\n${dateString} 新闻条目数: ` + dailyItems.length + ', 抓取该日条目消耗时间: ' + (Date.now() - dailyStartTime) + ' 毫秒\n');


    await currentPage.waitForTimeout(100);
  }


  // 关闭 headless 浏览器
  await browser.close();
  console.log('抓取总消耗时间: ' + (Date.now() - crawlStartTime) + ' 毫秒\n');
  return XinwenLianbo;
}


/**
 * 辅助函数 splitBySubtitle(paragraphs, subtitles)
 * 将一个页面中的粗体小标题和正文组织起来
 * @param paragraphs: 所有正文段落数组
 * @param subtitles: 所有粗体小标题数组
 */
function splitBySubtitle(paragraphs, subtitles) {

  // 计算小标题对应的段落序数，生成新数组
  let start = 0;
  let subtitleIndex = subtitles.map(subtitle => {
    for (let k = start; k < paragraphs.length; k++) {
      if (paragraphs[k] === subtitle) {
        start = k + 2;
        return k;
      }
    }
  });
  subtitleIndex.push(paragraphs.length); //段落数的最后界限


  let simpleItems = []; // 只包含小标题和正文的简要item数组
  if (paragraphs[0] !== subtitles[0]) {
    // paragraphs[0] === subtitles[0] 时，对应国内联播快讯或国际联播快讯，正文第一行就是小标题
    // 反之，说明正文段落后面才有小标题，这段总览性正文要单独作为一个条目
    simpleItems.push({
      subtitle: '',
      content: paragraphs.slice(0, subtitleIndex[0]).join('\n')
    });
  }
  // 然后每个小标题引领小标题之间的正文，成为一个条目
  for (let k = 0; k < subtitles.length; k++) {
    simpleItems.push({
      subtitle: subtitles[k],
      content: paragraphs.slice(subtitleIndex[k] + 1, subtitleIndex[k + 1]).join('\n'),
    });
  }
  return simpleItems;
}


/**
 * saveData(recentItems) 将抓取到的对象数组保存到json和数据库
 * 千万注意相对路径，./ 还是 ../
 * @param recentItems: 抓取到的新闻对象数组
 */
async function saveData(recentItems) {
  save2JSON(recentItems); // 更新JSON文件
  save2MongoDB(recentItems); // 插入 MongoDB
  save2SQLite(recentItems); // 插入 SQLite
}


function save2JSON(recentItems) {
  const savedItems = JSON.parse(fs.readFileSync('./XinwenLianbo.json', "utf8"));
  const newsUpdated = savedItems.concat(recentItems);
  fs.writeFileSync('./XinwenLianbo.json', JSON.stringify(newsUpdated), "utf8");
  console.log('Data in json updated.');
}


async function save2MongoDB(recentItems) {

  console.log('Insert to MongoDB...');

  // 连接MongoDB服务
  const client = new MongoClient('mongodb://localhost:27017/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect()
    .then(() => console.log('Connected successfully to server.'))
    .catch(err => {
      console.log('Connected failed. ');
      console.error(err);
    });


  // 连接数据库
  const newsCrawling = client.db("newsCrawling");
  // 连接 collection
  const XinwenLianbo = newsCrawling.collection("XinwenLianbo");
  // 添加 documents
  const insertResult = await XinwenLianbo.insertMany(recentItems);
  console.log(`${insertResult.insertedCount} items were inserted`);
  // 查询 documents
  // const findOptions = { projection: { _id: 0, date: 1, number: 1 }, };
  // const cursor = XinwenLianbo.find({}, findOptions).limit(10);
  // await cursor.forEach(document => console.log(document));
  // 删除 documents
  // const deleteResult = await XinwenLianbo.deleteMany({});
  // console.log("Deleted " + deleteResult.deletedCount + " documents");


  // 关闭与服务器的连接
  await client.close();
}


async function save2SQLite(recentItems) {

  console.log('Insert to SQLite...');

  // 连接数据库
  const db = new sqliteClient('../database/newsCrawling-sqlite3.db', {
    fileMustExist: false,
    // verbose: console.log, // 每次执行SQL语句都打印出来
  });

  // 创建表
  // db.prepare('DROP TABLE IF EXISTS XinwenLianbo').run();
  // db.prepare(
  //   `CREATE TABLE IF NOT EXISTS XinwenLianbo (
  //     date VARCHAR(255), 
  //     listIndex INT(3),
  //     title VARCHAR(255),
  //     subtitle VARCHAR(255),
  //     link VARCHAR(255),
  //     content TEXT,
  //     number INT(3),
  //     PRIMARY KEY (date, number)
  //     )`).run();

  // 批量插入
  const insert = db.prepare('INSERT INTO XinwenLianbo (date, listIndex, title, subtitle, link, content, number) VALUES (@date, @listIndex, @title, @subtitle, @link, @content, @number)');
  const insertMany = db.transaction(news => {
    for (let item of news) insert.run(item);
  });
  insertMany(recentItems);

  // 查询
  // db.prepare('SELECT * FROM XinwenLianbo').all()
  //   .forEach(row => console.log(row.title + row.subtitle));

  // 删除
  // db.prepare('DELETE FROM XinwenLianbo').run();

  // 断开连接
  db.close();
}