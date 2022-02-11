const expect = require('chai').expect;

const { TextureManager, TextureUtils } = require('./index.js');

describe('TextureManager', function() {
  it('', async function() {

  });
});

describe('TextureUtils', function() {
  it('flattenAtlases', async function() {
    const atlases = TextureUtils.flattenAtlases({
      test: {
        atlas1: {
          url: "url1",
        },
        atlas2: {
          url: "url2",
        }
      },
      atlas3: {
        url: "url3",
      },
      array: [
        {
          atlas4: {
            url: "url4",
          },
        }
      ],
    });
    expect(atlases[0].id).to.equal('test.atlas1');
    expect(atlases[0].url).to.equal('url1');
    expect(atlases[1].id).to.equal('test.atlas2');
    expect(atlases[1].url).to.equal('url2');
    expect(atlases[2].id).to.equal('atlas3');
    expect(atlases[2].url).to.equal('url3');
    expect(atlases[3].id).to.equal('array.0.atlas4');
    expect(atlases[3].url).to.equal('url4');
  });
});
