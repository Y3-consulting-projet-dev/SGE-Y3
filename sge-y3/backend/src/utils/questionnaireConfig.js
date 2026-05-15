const fs = require('fs');
const path = require('path');

const matrixData = require('../data/competencyMatrix.generated.json');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'rhQuestionnaire.custom.json');
const DEFAULT_CONFIG = {
  customPages: [],
  pageAdditions: [],
};

function readQuestionnaireConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return { ...DEFAULT_CONFIG };
    }

    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(content || '{}');

    return {
      customPages: Array.isArray(parsed.customPages) ? parsed.customPages : [],
      pageAdditions: Array.isArray(parsed.pageAdditions) ? parsed.pageAdditions : [],
    };
  } catch (error) {
    return { ...DEFAULT_CONFIG };
  }
}

function writeQuestionnaireConfig(config = DEFAULT_CONFIG) {
  const normalized = {
    customPages: Array.isArray(config.customPages) ? config.customPages : [],
    pageAdditions: Array.isArray(config.pageAdditions) ? config.pageAdditions : [],
  };

  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function getQuestionnaireSourceSheets() {
  return Object.keys(matrixData).map((sheet) => ({
    value: sheet,
    label: sheet,
  }));
}

module.exports = {
  CONFIG_PATH,
  getQuestionnaireSourceSheets,
  readQuestionnaireConfig,
  writeQuestionnaireConfig,
};
