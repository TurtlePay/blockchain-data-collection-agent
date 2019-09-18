# TurtlePay™ Blockchain Data Collection Agent
![Version](https://img.shields.io/badge/version-0.1.4-blue.svg?cacheSeconds=2592000) ![Prerequisite](https://img.shields.io/badge/node-%3E%3D6-blue.svg) [![Documentation](https://img.shields.io/badge/documentation-yes-brightgreen.svg)](https://github.com/TurtlePay/blockchain-data-collection-agent#readme) [![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/TurtlePay/blockchain-data-collection-agent/graphs/commit-activity) [![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-yellow.svg)](https://github.com/TurtlePay/blockchain-data-collection-agent/blob/master/LICENSE) [![Twitter: TurtlePay](https://img.shields.io/twitter/follow/TurtlePay.svg?style=social)](https://twitter.com/TurtlePay)

#### Master Build Status
[![Build Status](https://travis-ci.org/TurtlePay/blockchain-data-collection-agent.svg?branch=master)](https://travis-ci.org/TurtlePay/blockchain-data-collection-agent) [![Build status](https://ci.appveyor.com/api/projects/status/github/TurtlePay/blockchain-data-collection-agent?branch=master&svg=true)](https://ci.appveyor.com/project/brandonlehmann/blockchain-data-collection-agent/branch/master)


> Collects TurtleCoin™ blockchain data into a SQL backend that serving and using the data a breeze.

## Prerequisites

- TurtleCoin >= 0.12.0
- node >=6
- MariaDB/MySQL with InnoDB support

## Hardware Requirements

For the best performance when using this package (as of June 30, 2019), your Database server must have a minimum of the following:

* 32GB RAM
  * 30GB dedicated to MariaDB/MySQL
* 2 CPU Cores (4 Recommended)
* SSD Storage

***Warning***: Running the DB on system(s) with less than the minimum hardware requirements above will cause performance issues. If you are experiencing issues please verify that the system you are using meets the minimum requirements above. We cannot assist with performance issues with implementations that do not meet the above minimum requirements.

## Recommended Reading

The help tune your selected DBMS, we recommend that you read the following documents, at a minimum, to tune your DBMS installation for the dataset this package manages.

This list is by no means comprehensive nor do we guarantee the information or suggestions provided in the articles below are accurate. These links are provided solely as a jumping off point to get you started.

* [MySQL 5.7 Performance Tuning After Installation](https://www.percona.com/blog/2016/10/12/mysql-5-7-performance-tuning-immediately-after-installation/)
* [InnoDB Performance Optimization Basics](https://www.percona.com/blog/2013/09/20/innodb-performance-optimization-basics-updated/)
* [Optimizing InnoDB Disk I/O](https://dev.mysql.com/doc/refman/8.0/en/optimizing-innodb-diskio.html)
* [Optimizing InnoDB Configuration Variables](https://dev.mysql.com/doc/refman/8.0/en/optimizing-innodb-configuration-variables.html)
* [15 Useful MySQL/MariaDB Performance Tuning and Optimization Tips](https://www.tecmint.com/mysql-mariadb-performance-tuning-and-optimization/)
* [InnoDB Performance Optimisation](https://www.slideshare.net/MyDBOPS/innodb-performance-optimisation)

## Install

```sh
npm install
```

## Usage

1) Set your environment variables and start the service up

```sh
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USERNAME=yourdbusername
export MYSQL_PASSWORD=yourdbpassword
export MYSQL_DATABASE=yourdbname
export NODE_HOST=localhost
export NODE_PORT=11898
export NODE_BLOCKS=1000
export NODE_TIMEOUT=12000
npm start
```

**Note:** environment variables can be stored in a .env and will be automatically imported.


## Run tests

```sh
npm test
```

## Author

👤 **TurtlePay™ Development Team**

* Twitter: [@TurtlePay](https://twitter.com/TurtlePay)
* Github: [@TurtlePay](https://github.com/TurtlePay)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

Feel free to check [issues page](https://github.com/TurtlePay/blockchain-data-collection-agent/issues).

## Show your support

Give a ⭐️ if this project helped you!


## 📝 License

Copyright © 2018-2019 [TurtlePay™ Development Team](https://github.com/TurtlePay).

This project is [AGPL-3.0](https://github.com/TurtlePay/blockchain-data-collection-agent/blob/master/LICENSE) licensed.

***
_This README was generated with ❤️ by [readme-md-generator](https://github.com/kefranabg/readme-md-generator)_
