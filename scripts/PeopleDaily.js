// @ts-check
'use strict';
// PeopleDaily.js
// 爬取人民日报，注意适当增加爬取的时间间隔

const fs = require("fs");
const puppeteer = require('puppeteer');
const { MongoClient } = require("mongodb");
const sqliteClient = require('better-sqlite3');


// config
const timeSpan = 1; //共抓取的天数
main();


async function main() {
  const dateRange = getDateRange(timeSpan);
  const itemsToAdd = await crawl(dateRange);
  await saveData(itemsToAdd);
  saveAbstract(itemsToAdd);
}


/**
 * 计算待爬取的日期范围
 * @param timeSpan 从昨天向前，爬取多少天的条目
 */
function getDateRange(timeSpan) {
  let dateRange = [];
  const date = new Date();
  for (let i = 0; i < timeSpan; i++) { // 数组的最后一项是爬取函数停止日期
    date.setDate(date.getDate() - 1); // 程序一般从新一天的凌晨开始跑，因此爬取从前一天发布的新闻开始
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    dateRange.push({ year: year, month: month, day: day });
  }
  return dateRange;
}


/**
 * 爬取人民日报全文
 * @param dateRange: 要爬取的日期数组，每个元素都是一个包含了年月日分量的对象
 */
async function crawl(dateRange) {

  // 启动 headless 浏览器
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1920, height: 1080, isMobile: false, },
  });
  let pages = await browser.pages();
  let currentPage = pages[0];


  // 程序运行计时器
  const t0 = Date.now();

  let PeopleDaily = [];
  // 第一层迭代，迭代日期
  for (let targetDate of dateRange) {
    const normalDate = targetDate.year + '-' + targetDate.month + '-' + targetDate.day;
    console.log('Crawling newspaper on ' + normalDate + ' ...');

    const urlDate = targetDate.year + '-' + targetDate.month + '/' + targetDate.day + '/';
    const url = 'http://paper.people.com.cn/rmrb/html/' + urlDate + 'nbs.D110000renmrb_01.htm';
    await currentPage.goto(url);
    const pageNames = await currentPage.$$eval('div.swiper-slide>a', nodes => nodes.map(node => node.textContent));
    const pageLinks = await currentPage.$$eval('div.swiper-slide>a', nodes => nodes.map(node => node.getAttribute('href')));


    const timePerDay = Date.now();
    const subPage = await browser.newPage();
    let dailyItems = [];
    // 第二层迭代，迭代版面
    for (let i = 0; i < pageNames.length; i++) {

      const pageName = pageNames[i];
      const link = 'http://paper.people.com.cn/rmrb/html/' + urlDate + pageLinks[i];
      await subPage.goto(link);
      console.log('Crawling ' + pageName);

      const pageItems = await subPage.evaluate((normalDate, urlDate, pageName) => {
        const items = [];
        document.querySelectorAll('ul.news-list>li>a')
          .forEach(node => {
            const title = node.textContent.trim();
            const link = 'http://paper.people.com.cn/rmrb/html/' + urlDate + node.getAttribute('href');
            items.push({
              date: normalDate,
              page: pageName,
              title: title,
              link: link,
            });
          });
        return items;
      }, normalDate, urlDate, pageName); // 传入匿名函数的参数

      dailyItems = dailyItems.concat(pageItems.filter(item => item.title !== ''));
      await currentPage.waitForTimeout(10); // 两次爬取间隔
    }
    await subPage.close();
    // console.log(dailyItems);


    // 得到一天报纸所有的page, title和链接后，循环爬取全文
    const itemPage = await browser.newPage();
    for (let item of dailyItems) {
      console.log('Crawling ' + item.page + ' ' + item.title);
      await itemPage.goto(item.link);
      const mainNode = await itemPage.$('div.article');
      const h3 = await mainNode.$eval('h3', node => node.textContent.trim());
      const h1 = await mainNode.$eval('h1', node => node.textContent.trim());
      const h2 = await mainNode.$eval('h2', node => node.textContent.trim());
      item.head = h3 + '\n' + h1 + '\n' + h2;
      item.author = await mainNode.$eval('p.sec', node => node.textContent.split('《\n')[0].trim());
      item.content = (await mainNode.$$eval('div#ozoom>p', nodes => nodes.map(node => node.textContent.trim()))).join('\n');
      await subPage.waitForTimeout(10); // 两次爬取间隔
    }
    await itemPage.close();


    console.log(normalDate + '条目数: ' + dailyItems.length + '. 抓取该日条目消耗时间: ' + (Date.now() - timePerDay) + ' 毫秒\n\n');
    PeopleDaily = PeopleDaily.concat(dailyItems);
    await currentPage.waitForTimeout(10); // 两次爬取间隔
  }

  console.log('总消耗时间: ' + (Date.now() - t0) + ' 毫秒');
  await browser.close();

  return PeopleDaily;
}


async function saveData(items) {
  save2JSON(items); // 更新JSON文件
  save2MongoDB(items); // 插入 MongoDB
  save2SQLite(items);
}
async function save2JSON(items) {
  const savedItems = JSON.parse(fs.readFileSync('../json/PeopleDaily.json', "utf8"));
  const itemsUpdated = savedItems.concat(items);
  fs.writeFileSync('../json/PeopleDaily.json', JSON.stringify(itemsUpdated, null, "  "), "utf8");
  console.log('Data in json updated.');
}
async function save2MongoDB(items) {

  console.log('Inserting to MongoDB...');

  // 连接MongoDB服务
  const client = new MongoClient('mongodb://localhost:27017/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect()
    .then(
      // () => console.log('Connected successfully to MongoDB server.')
    )
    .catch(err => {
      console.error(err);
    });


  // 连接数据库
  const newsCrawling = client.db("newsCrawling");
  // 连接 collection
  const PeopleDaily = newsCrawling.collection("PeopleDaily");
  // 添加 documents
  const insertResult = await PeopleDaily.insertMany(items);
  console.log(`${insertResult.insertedCount} items inserted.`);
  // 查询 documents
  // const findOptions = { projection: { _id: 0 }, };
  // const cursor = PeopleDaily.find({}, findOptions).limit(10);
  // await cursor.forEach(document => console.log(document));
  // 删除 documents
  // const deleteResult = await PeopleDaily.deleteMany({});
  // console.log("Deleted " + deleteResult.deletedCount + " documents");


  // 关闭与服务器的连接
  await client.close();
}
async function save2SQLite(items) {

  console.log('Inserting to SQLite...');

  // 连接数据库
  const db = new sqliteClient('../database/newsCrawling-sqlite3.db', {
    fileMustExist: false,
    // verbose: console.log, // 每次执行SQL语句都打印出来
  });

  // 创建表
  // db.prepare('DROP TABLE IF EXISTS PeopleDaily').run();
  // db.prepare(
  //   `CREATE TABLE IF NOT EXISTS PeopleDaily (
  //     date VARCHAR(255), 
  //     page VARCHAR(255),
  //     title VARCHAR(255),
  //     link VARCHAR(255),
  //     head VARCHAR(255),
  //     author VARCHAR(255),
  //     content TEXT,
  //     PRIMARY KEY (date, page, title)
  //     )`).run();

  // 批量插入
  const insert = db.prepare('INSERT INTO PeopleDaily (date, page, title, link, head, author, content) VALUES (@date, @page, @title, @link, @head, @author, @content)');
  const insertMany = db.transaction(news => {
    for (let item of news) insert.run(item);
  });
  insertMany(items);

  // 查询
  // db.prepare('SELECT * FROM PeopleDaily').all()
  //   .forEach(row => console.log({
  //     date: row.date,
  //     page: row.page,
  //     title: row.title,
  //     author: row.author,
  //     link: row.link,
  //   }));

  // 删除
  // db.prepare('DELETE FROM PeopleDaily').run();

  // 断开连接
  db.close();
}


function saveAbstract(recentItems) {
  const abstracts = recentItems.filter(item => !item.head.includes('广告'))
    .map(item => {
      const link = item.link;
      const text = '【' + item.page + '】' + item.head;
      return `<li><a href="${link}">${text}</a></li>`;
    }).join('');

  const htmlText = '<h2>人民日报</h2><ul>' + abstracts + '</ul>';

  fs.writeFileSync('./abstract-PeopleDaily.txt', htmlText, "utf8");
  console.log('Abstracts of PeopleDaily saved.');
}