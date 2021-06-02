

[TOC]

# 每日政经新闻聚合平台

## 平台入口和项目地址

### 平台入口

- [国内入口](https://news-crawling-1305177755.cos-website.ap-hongkong.myqcloud.com/)
- [海外入口](https://humoonruc.github.io/newsCrawling.github.io/)


欲知每日大事，从此不必在众多新闻源中切换，关注该入口即可。

### 项目地址

- [国内地址](https://humoonruc.coding.net/p/node.js-demo/d/newsCrawling/git)
- [海外地址](https://github.com/Humoonruc/newsCrawling.github.io)

## 技术方案

### 数据获取

1. 本项目中，中文新闻都是用 Puppeteer 爬取的。
   1. Puppeteer 是一个使用 Chromium 内核的 headless browser（无头浏览器）
   2. 它可以模拟人类使用浏览器的每一步动作，防止被识别为爬虫
   3. 为防范法律风险（人民日报禁止商业目的的爬虫），中文新闻的全文数据不公开，仅展示新闻对应的原始链接

2. 由于服务器端科学上网的困难（我租的服务器在国内，海外服务器太贵了），直接爬取外网数据有一定障碍。因此对于外文新闻，本项目采取了如下解决方案：
   1. 在各大外媒上订阅邮件，内容是每日新闻的摘要和跳转链接
   2. 通过 Node（imap 模块和 mailparser 模块）建立 IMAP 客户端，读取外媒发来的邮件并解析
   3. 把解析结果同中文新闻汇总起来并形成 html 文件用于展示

### 信息安全

#### 数据的冗余备份

抓取的新闻全文以不同的格式保存三份：

1. JSON 文本文件
2. SQLite 文件式数据库
3. MongoDB 数据库（服务器上的数据库相对不安全，有被黑客入侵的危险，下图即为我遭遇过的一次黑客攻击）

![](http://humoon-image-hosting-service.oss-cn-beijing.aliyuncs.com/img/typora/JavaScript/服务器上MongoDB数据库被黑.png)

#### 关键信息的私有

本项目中，读取邮件时要使用邮箱的账号密码，构建项目时要使用腾讯云储存桶的账号密码——不能将这些信息跟项目代码一样公开。

为解决第一个问题，可以创建一个配置文件，程序脚本都从这个配置文件中导入账号密码等敏感信息，而配置文件本身在 `.gitignore` 文件中声明，不上传到代码托管平台。

为解决第二个问题，使用静态配置的 Jenkinsfile，而非在代码库中创建 Jenkinsfile 文件。这样 Jenkinsfile 被封闭在平台内部的构建任务中，对外不可见，也就保证了安全。

### 定时运行

利用服务器永不关机的优势，定时运行一个 shell 脚本，在其中启动若干爬虫程序抓取数据。

计划任务中，shell 脚本内的各行命令是堵塞式执行的，彻底运行完一条命令（也就是一个爬虫脚本）后才会执行下一条。

运行完所有爬虫脚本后，使用 SSH 方式 push 项目更新（主要是 json 数据文件和 html 展示文件）到代码托管平台。 


### 版本管理

#### 多平台托管

代码分别保存在个人电脑中和个人服务器上，此外还托管在 CODING 和 GitHub 上。

以香港服务器上运行的 CODING 为主要的远程仓库，GitHub 为备份仓库。GitHub 的缺点在于从国内访问的网络状况不够稳定；内地的 Gitee 平台则面临比较严格的审查，敏感数据可能被删除。CODING 避免了这两个缺点。

该项目生成的 html 文件托管在 GitHub Pages 和腾讯云储存桶[^腾讯云]上。GitHub Pages 有检测到项目更新便立即自动构建新页面的功能，腾讯云理论上也有，但不知为何不能正常工作，只能用每日定时构建，实现不那么及时的自动化。

[^腾讯云]:自建静态网站 - CODING 帮助中心：https://help.coding.net/docs/ci/practice/static-website-paas.html

#### 精简同步

利用 .gitignore 文件，指定不上传的文件和文件夹。

puppeteer 使用的 headless browser 有两百兆，太大了，不同步；SQlite 数据库为二进制文件，也不同步，否则 /.git/ 文件夹容易膨胀得非常恐怖。

```ini
# 不需要提交的目录
/node_modules
/database
/json

# 不需要提交的文件
config.js
```

### 全流程自动化

从启动系统脚本、爬取数据、整理数据、储存数据到远程仓库同步、静态网页构建，本项目实现了完全的自动化。

建成后不需要任何人工干预，即可发布与积累全球政经要闻的文本数据。

## 各媒体特点

The New York Times, BBC 和 RT (Russia Today) 都是综合性媒体，订阅邮件的主要内容是一天的热点，领域广而内容浅。RT 的评论区是一大特色，很多意见是西方主流媒体上看不到的。

FT中文网和 Foreign Affairs 内容就深一些，主要关注的也是政经新闻。