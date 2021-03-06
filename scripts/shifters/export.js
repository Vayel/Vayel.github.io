var configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Configuration");
var questionsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Questions");
var config = null;

function isUrl(text) {
  const expression = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
  const regex = new RegExp(expression);
  return text.match(regex);
}

function checkUnique(array, errorSuffix) {
  const unique = array.filter(function(item, pos) {
    return array.indexOf(item) == pos;
  });
  if (unique.length != array.length) throw "Il ne peut y avoir de duplicats dans " + errorSuffix + ".";
}

function readQuestionsConfig() {
  var keyVals = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges().filter(function(r) {
    return r.getName().split(".")[0] == "question";
  }).map(function(r) {
    return [
      r.getName().split(".")[1],
      r.getRange().getColumn()
    ];
  });
  var cols = {};
  for (var i = 0; i < keyVals.length; i++) {
    cols[keyVals[i][0]] = keyVals[i][1];
  }
  return { cols: cols };
}

function readQuestionGroupsConfig() {
  var range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName("groups");
  var cols = {}, cell;
  for (var j = 1; j <= range.getNumColumns(); j++) {
    cell = range.getCell(1, j);
    cols[cell.getValue()] = cell.getColumn();
  }
  return { cols: cols };
}

function updateConfig() {
  config = {
    questions: readQuestionsConfig(),
    questionGroups: readQuestionGroupsConfig(),
    export: {
      errorsCol: SpreadsheetApp.getActiveSpreadsheet().getRangeByName("export.errors").getColumn(),
      outputCol: SpreadsheetApp.getActiveSpreadsheet().getRangeByName("export.output").getColumn(),
      validatedQuestionState: configSheet.getRange(2, 1).getValue(),
    }
  };
}

function parseCellWithSep(content, sep) {
  if (typeof content !== "string") {
    content = content.toString();
  }
  return content.split(sep).map(function(el) {
    return el.trim();
  }).filter(function(el) {
    return el != "";
  });
}

function parseQuestionCell(row, colName, errors, parse) {
  const col = config.questions.cols[colName];
  const content = questionsSheet.getRange(row, col).getValue();
  if (!parse) return content;
  try {
    return parse(content);
  } catch(e) {
    errors.push(e);
  }
  return null;
}

function rowToJSON(row) {
  var question = {};
  var errors = [];
  
  question.id = row;
  
  question.text = parseQuestionCell(row, "text", errors, function(content) {
    if (!content) throw "L'intitulé de la question ne peut être vide.";
    return content;
  });
  
  question.type = parseQuestionCell(row, "type", errors, function(content) {
    content = content.trim().toLowerCase();
    if (content == "choix multiple") return "multiple_choice";
    if (content == "choix unique") return "single_choice";
    if (content == "classement") return "ranking";
    if (content == "catégorisation") return "classification";
    throw "Le type de question '" + content + "' n'est pas géré pour le moment.";
  });
  
  if (!question.type) return null;
  
  question.references = parseQuestionCell(row, "references", errors, function(content) {
    const references = parseCellWithSep(content, "\n\n");
    var parsed = [], ref, text, url;
    for (var i in references) {
      ref = references[i].split("\n");
      if (ref.length > 0) {
        text = ref[0].trim();
        if (!text) {
          throw "Le texte de la source doit contenir des caractères";
        }
        if (isUrl(text)) {
          throw 'La source "' + text + '" est une url. Peut-être avez-vous sauté une ligne sans le vouloir ? Sinon, veuillez utiliser un texte plus descriptif (nom de page, titre du livre...).';
        }
      }
      if (ref.length == 1) {
        parsed.push({
          text: text,
          url: null
        });
        continue;
      }
      if (ref.length == 2) {
        url = ref[1].trim();
        if (!isUrl(url)) {
          throw 'L\'url "' + url + '" de la source n\'est pas une url.';
        }
        parsed.push({
          text: text,
          url: url
        });
        continue;
      }
      throw 'La source "' + references[i] + '" doit être sur une ou deux lignes seulement.';
    }
    if (!parsed.length) throw "Il manque une source.";
    return parsed;
  });
  
  question.categories = parseQuestionCell(row, "categories", errors, function(content) {
    return parseCellWithSep(content, ",").map(function(word) {
      return word.toLowerCase();
    });
  });
  
  question.keywords = parseQuestionCell(row, "keywords", errors, function(content) {
    return parseCellWithSep(content, ",").map(function(word) {
      return word.toLowerCase();
    });
  });
  
  question.level = parseQuestionCell(row, "level", errors, function(content) {
    if (!content) throw "Le niveau de la question ne peut être vide.";
    return content.toLowerCase();
  });
  
  question.choices = parseQuestionCell(row, "choices", errors, function(content) {
    if (question.type == "single_choice" || question.type == "multiple_choice" || question.type == "ranking") {
      const choices = parseCellWithSep(content, "\n");
      if (choices.length < 2) throw "Il doit au moins y avoir deux choix.";
      checkUnique(choices, "les choix");
      return choices;
    }
    if (question.type == "classification") {
      const elements = parseCellWithSep(content, "\n");
      checkUnique(elements, "les éléments");
      const categories = parseQuestionCell(row, "category_choices", errors, function(content) {
        const categories = parseCellWithSep(content, "\n");
        if (categories.length < 2) throw "Il doit au moins y avoir deux catégories.";
        checkUnique(categories, "les catégories");
        return categories;
      });
      return [elements, categories];
    }
  });
  
  question.answer = parseQuestionCell(row, "answer", errors, function(content) {
    var answer;
    if (question.type == "single_choice") {
      answer = content.trim();
      if (question.choices.indexOf(answer) == -1) throw 'La réponse "' + choice + '" n\'apparait pas dans la liste des choix.';
      return answer;
    }
    if (question.type == "multiple_choice") {
      answer = parseCellWithSep(content, "\n");
      checkUnique(answer, "la réponse");
      var choice;
      for (var i in answer) {
        choice = answer[i];
        if (question.choices.indexOf(choice) == -1) throw 'La réponse "' + choice + '" n\'apparait pas dans la liste des choix.';
      }
      return answer;
    }
    if (question.type == "ranking") {
      return question.choices;
    }
    if (question.type == "classification") {
      const trueCategories = parseCellWithSep(content, "\n");
      const elements = question.choices[0];
      const categories = question.choices[1];
      if (elements.length != trueCategories.length) throw "La réponse doit contenir autant de catégories qu'il y a d'éléments.";
      var cat;
      for (var i in trueCategories) {
        cat = trueCategories[i];
        if (categories.indexOf(cat) == -1) throw 'La réponse "' + cat + '" n\'apparait pas dans la liste des catégories.';
      }
      var answer = {};
      for (var i in trueCategories) {
        answer[elements[i]] = trueCategories[i];
      }
      return answer;
    }
  });
  
  question.explanation = parseQuestionCell(row, "explanation").trim();
  
  question.groups = (function() {;
    var groups = [], content;
    for (var group in config.questionGroups.cols) {
      content = questionsSheet.getRange(row, config.questionGroups.cols[group]).getValue();
      content = content.trim().toLowerCase();
      if (content == "oui") {
        groups.push(group);
      }
    }
    return groups;
  })();
  
  return {
    isValidated: parseQuestionCell(row, "state") == config.export.validatedQuestionState,
    question: question,
    errors: errors
  };
}

function export(rowIndex) {
  if (rowIndex === undefined) return;
  updateConfig();
  
  row = rowToJSON(rowIndex);
  if (row === null) {
    questionsSheet.getRange(rowIndex, config.export.errorsCol).setValue("");
  }
  else {
    questionsSheet.getRange(rowIndex, config.export.errorsCol).setValue(
      row.errors.join("\n\n")
    );
  }
  if (row === null || row.errors.length || !row.isValidated) {
    questionsSheet.getRange(rowIndex, config.export.outputCol).setValue("");
  }
  else {
    questionsSheet.getRange(rowIndex, config.export.outputCol).setValue(
      JSON.stringify(row.question, null, 2)
    );
  }
}

function onEdit(e) {
  if (e.range.getSheet().getIndex() != questionsSheet.getIndex()) return;
  export(e.range.getRow());
}
