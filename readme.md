

[TOC]

# 每日政经新闻聚合平台



**平台入口：[国内入口](https://news-crawling-1305177755.cos-website.ap-hongkong.myqcloud.com/)|[海外入口因安全原因暂时关闭](https://humoonruc.github.io/newsCrawling.github.io/)**

欲知每日大事，从此不必在众多新闻源中切换，关注该入口即可。



项目地址（GitHub）：[Crawl news on Internet and save them locally, focusing on international politics and economy](https://github.com/Humoonruc/newsCrawling.github.io)

## 技术方案

### 数据获取

1. 本项目中，中文新闻都是用 Puppeteer 爬取的。
   1. Puppeteer 是一个使用 Chromium 内核的 headless browser
   2. 它可以模拟浏览器的动作，防止被识别为爬虫
   3. 中文新闻的全文数据暂不公开，仅展示新闻对应的媒体链接

2. 由于在服务器上科学上网的困难（我租的服务器在国内，海外的服务器太贵了），直接爬取外网数据有一定障碍。因此对于外文新闻，本项目采取了如下解决方案：
   1. 在各大外媒上订阅邮件，内容是每日新闻的摘要和跳转链接
   2. 通过 node 建立 IMAP 客户端，读取外媒发来的邮件并解析
   3. 把解析结果同中文新闻汇总起来并形成 html 文件用来展示



### 数据保存

#### 冗余备份

抓取的新闻全文以不同的格式保存三份：

1. JSON 文本文件
2. sqlite3 文件式数据库
3. MongoDB 数据库（服务器上的数据库相对不安全，有被黑客入侵的危险）

![](http://humoon-image-hosting-service.oss-cn-beijing.aliyuncs.com/img/typora/JavaScript/服务器上MongoDB数据库被黑.png)



### 定时运行

利用服务器永不关机的优势，定时运行一个 shell 脚本，在其中启动若干爬虫脚本抓取数据。

计划任务中，shell 脚本内的各行命令是堵塞式同步执行的，彻底运行完一条命令（也就是一个爬虫脚本）后才会执行下一条。

运行完所有爬虫脚本后，使用 SSH 方式 push 项目更新到代码托管平台。 



### 版本管理

#### 多平台托管

代码分别保存在个人电脑中和个人服务器上，此外还托管在 CODING 和 GitHub 上。

以香港服务器上运行的 CODING 为主要的远程仓库，GitHub 为备份仓库。GitHub 的缺点在于国内访问的网络不稳定；内地的 Gitee 平台则面临比较严格的审查，敏感数据可能被删除。

该项目生成的 html 文件托管在 GitHub Pages 和 腾讯云储存桶上。GitHub Pages 有检测提交自动构建的功能，腾讯云理论上也有，但不知为何不能正常工作，只能用定时构建，实现不那么及时的自动化。

#### 精简同步

利用 .gitignore 文件，指定不上传和同步的文件。

puppeteer 使用的 headless browser 有两百兆，太大了，不同步；SQlite 数据库为二进制文件，也不同步，否则 /.git/ 文件夹容易膨胀得非常恐怖。

### 全流程自动化

从启动系统脚本、爬取数据、整理数据、储存数据到远程仓库同步、静态网页构建，本项目实现了完全的自动化。

建成后不需要任何人工干预，即可发布与积累全球政经要闻的文本数据。

## 各媒体特点

The New York Times, BBC 和 RT (Russia Today) 都是综合性媒体，订阅邮件的主要内容是一天的热点，领域广而内容浅。RT 的评论区是一大特色，很多意见是西方主流媒体上看不到的。

FT中文网和 Foreign Affairs 内容就深一些，主要关注的也是政经新闻。
