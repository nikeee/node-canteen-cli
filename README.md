# node-canteen-cli [![Build Status](https://travis-ci.org/nikeee/node-canteen-cli.svg?branch=master)](https://travis-ci.org/nikeee/node-canteen-cli) ![Dependency Status](https://david-dm.org/nikeee/node-canteen-cli.svg)

Data scraper for Uni Kassel Mensa.

### Prerequisites:
- node

### Installation:
```bash
git clone https://github.com/nikeee/node-canteen-cli
cd node-canteen-cli
npm i
tsc
```

### Usage
```bash
node build/app.js list # to list evailable canteens
node build/app.js pull -c <name> # to pull data as JSON of a specific canteen
```
Output will be stdout.

To pull all available canteens into separate files:
```bash
node build/app.js list | parallel "node build/app.js pull -c {} > {}.json"
```
