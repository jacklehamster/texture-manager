# texture-manager
Rearrange and store textures for use in WebGL

[![CodeQL](https://github.com/jacklehamster/texture-manager/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/jacklehamster/texture-manager/actions/workflows/codeql-analysis.yml)

[![pages-build-deployment](https://github.com/jacklehamster/texture-manager/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/jacklehamster/texture-manager/actions/workflows/pages/pages-build-deployment)

[![pmd](https://github.com/jacklehamster/texture-manager/actions/workflows/pmd-analysis.yml/badge.svg)](https://github.com/jacklehamster/texture-manager/actions/workflows/pmd-analysis.yml)

## Setup

### Directly in web page

Include the scripts in html as follow:
```
<script src="https://unpkg.com/texture-manager/public/texture-manager.js"></script>
```


### Through NPM


Add to `package.json`:
```
  "dependencies": {
  	...
    "texture-manager": "^1.0.0",
    ...
  }
```


Use Browserify to make classes available in browser

In `package.json`:
```
  "scripts": {
  	...
    "browserify": "browserify browserify/main.js -s dok-lib -o public/gen/compact.js",
    ...
  },
```

In `browserify/main.js`:
```
const { TextureManager, TextureUtils, SlotAllocator } = require('texture-manager');
module.exports = {
  TextureManager,
  TexureUtils,
  SlotAllocator
};
```

## Components

### TextureManager

#### Description
TextureManager packs textures in WebGL for use as sprite atlas.

#### Usage

*Work in progress*


### Demo

[demo](https://jacklehamster.github.io/texture-manager/)