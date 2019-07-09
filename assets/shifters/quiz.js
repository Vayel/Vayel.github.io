const Quiz = (function() {
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  class AbstractQuestion {
    constructor(type, parent, question) {
      this.type = type;
      this.parent = parent;
      this.question = question;
    }

    _getWrapper() {
      return $("#question-" + this.question.id);
    }

    _getForm() {
      return this._getWrapper().find("form");
    }

    check() {
      throw "Not implemented";
    }

    renderCheck(correct) {
      this._getWrapper().find(".help").show();

      const icon = this._getWrapper().find(".header .icon");
      icon.removeClass("success_color mistake_color unanswered_color");
      if (correct) {
        icon.addClass("success_color");
        icon.html('<i class="fa fa-check-circle-o fa-2x"></i>');
        return;
      }
      else if (correct === false) {
        icon.addClass("mistake_color");
        icon.html('<i class="fa fa-times-circle-o fa-2x"></i>');
        return;
      }
      icon.addClass("unanswered_color");
      icon.html('<i class="fa fa-question-circle-o fa-2x"></i>');
    }

    render() {
      const explanation = !this.question.explanation ? "" : (
        '<div class="explanation_wrapper">' +
          '<p class="title">Explication :</p>' +
          '<p class="explanation">' +
            this.question.explanation.split("\n").join("<br />") +
          '</p>' +
        '</div>'
      );
      const references = "TODO";

      $(this.parent).append(
        '<div id="question-' + this.question.id + '" class="question ' + this.type + '">' +
          '<div class="header">' +
            '<div class="icon unanswered_color">' +
              '<i class="fa fa-question-circle-o fa-2x"></i>' +
            '</div>' +
            '<p class="title">' + this.question.text + '</p>' +
          '</div>' +
          '<form></form>' +
          '<div class="help">' +
            '<div class="answer_wrapper expandable">' +
              '<a href="#" class="header">Réponse</a>' +
              '<div class="content">' +
                '<div class="answer"></div>' +
                explanation +
              '</div>' +
            '</div>' +
            '<div class="references expandable">' +
              '<a href="#" class="header">Sources</a>' +
              '<div class="content">' + references + '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
      this.renderForm(this._getForm());
      this.renderAnswer(this._getWrapper().find(".help .answer_wrapper .answer"));

      for (let className of ["answer_wrapper", "references"]) {
        (function(expandableBlock) {
          expandableBlock.find(".header").click((e) => {
            e.preventDefault();
            expandableBlock.find(".content").toggle()
          });
        })(this._getWrapper().find(".help ." + className));
      }
    }

    renderForm(form) {
      throw "Not implemented";
    }

    renderAnswer(parent) {
      throw "Not implemented";
    }
  }

  class SingleChoice extends AbstractQuestion {
    constructor(parent, question, shuffleChoices = true) {
      if (shuffleChoices) {
        shuffle(question.choices);
      }
      super("single_choice", parent, question);
      this._inputsName = "question-" + this.question.id;
    }

    check() {
      let selected = this._getForm().find(
        "input[name=" + this._inputsName + "]:checked"
      ).val();
      if (selected === undefined) return null;
      return selected === this.question.answer;
    }

    renderForm(form) {
      form.append($.map(this.question.choices, (choice, i) => {
        let id = this._inputsName + "-" + i;
        return (
          '<div class="choice">' +
            '<input ' +
              'id="' + id + '" ' +
              'type="radio" ' +
              'name="' + this._inputsName + '" ' +
              'value="' + choice + '" ' +
            '/>' +
            '<label for="' + id + '">' + choice + '</label>' +
          '</div>'
        );
      }));
    }

    renderAnswer(parent) {
      parent.append(this.question.answer);
    }
  };

  class MultipleChoice extends AbstractQuestion {
    constructor(parent, question, shuffleChoices = true) {
      if (shuffleChoices) {
        shuffle(question.choices);
      }
      super("multiple_choice", parent, question);
      this._inputsName = "question-" + this.question.id;
    }

    check() {
      let selected = new Set();
      this._getForm().find("input:checked").each(function() {
        selected.add(this.value);
      });
      if (!selected.size) return null;
      return new Immutable.Set(selected).equals(
        new Immutable.Set(this.question.answer)
      );
    }

    renderForm(form) {
      form.append($.map(this.question.choices, (choice, i) => {
        let id = this._inputsName + "-" + i;
        return (
          '<div class="choice">' +
            '<input ' +
              'id="' + id + '" ' +
              'type="checkbox" ' +
              'value="' + choice + '" ' +
            '/>' +
            '<label for="' + id + '">' + choice + '</label>' +
          '</div>'
        );
      }));
    }

    renderAnswer(parent) {
      parent.append(this.question.answer.join("<br />"));
    }
  };

  class Ranking extends AbstractQuestion {
    constructor(parent, question, shuffleChoices = true) {
      if (shuffleChoices) {
        shuffle(question.choices);
      }
      super("ranking", parent, question);
    }

    check() {
      let answer = [];
      this._getForm().find("ul").children().each(function() {
        answer.push(this.innerText);
      });
      return new Immutable.List(answer).equals(
        new Immutable.List(this.question.answer)
      );
    }

    renderForm(form) {
      form.append(
        '<ul class="sortable">' +
        this.question.choices.map(
          (choice) => '<li>' + choice + '</li>'
        ).join("") + 
        '</ul>'
      );
      form.find("ul").sortable();
    }

    renderAnswer(parent) {
      parent.append(
        '<ol>' +
          this.question.answer.map(
            text => '<li>' + text + '</li>'
          ).join("") +
        '</ol>'
      );
    }
  };

  class Classification extends AbstractQuestion {
    constructor(parent, question, shuffleChoices = true) {
      if (shuffleChoices) {
        shuffle(question.choices[0]);
      }
      super("classification", parent, question);
    }

    check() {
      let elToCat = {};
      this._getForm().find(".choice").each(function() {
        const name = $(this).find(".name").html();
        const cat = $(this).find(".categories select").val();
        elToCat[name] = cat;
      });
      return Immutable.Map(elToCat).equals(
        Immutable.Map(this.question.answer)
      );
    }

    renderForm(form) {
      form.append(
        '<table>' +
        this.question.choices[0].map(choice => (
          '<tr class="choice">' +
            '<td class="name">' + choice + '</td>' +
            '<td class="categories">' +
              '<select>' +
                this.question.choices[1].map(
                  cat => '<option value="' + cat + '">' + cat + '</option>'
                ) +
              '</select>' +
            '</td>' +
          '</tr>'
        )).join("") +
        '</table>'
      );
    }

    renderAnswer(parent) {
      parent.append(
        '<ul>' +
          $.map(this.question.answer, (cat, el) =>
            '<li>' + el + ' : ' + cat + '</li>'
          ).join("") +
        '</ul>'
      );
    }
  };

  return (wrapper, questions) => {
    const check = () => {
      const isCorrect = questions.map(q => q.check());
      renderCheck(isCorrect);
      renderStats(isCorrect);
    };

    const renderCheck = (isCorrect) => {
      for (let i in isCorrect) {
        questions[i].renderCheck(isCorrect[i]);
      }
    };

    const renderStatsRow = (parent, iconName, colorClass, n, nTotal) => {
      $(parent).append(
        '<div class="row">' +
          '<i class="' + (colorClass + ' icon fa fa-' + iconName + ' fa-3x') + '"></i>' +
          '<div class="proportion">' +
            '<span class="' + colorClass + '">' + n + '</span> / ' + nTotal +
          '</div>' +
        '</div>'
      );
    };

    const renderStats = (isCorrect) => {
      const stats = $(wrapper).find(".stats");
      stats.html("");
      const n = isCorrect.length;
      
      renderStatsRow(
        stats,
        "check-circle-o",
        "success_color",
        isCorrect.filter(x => x).length,
        n
      );

      renderStatsRow(
        stats,
        "times-circle-o",
        "mistake_color",
        isCorrect.filter(x => x === false).length,
        n
      );

      renderStatsRow(
        stats,
        "question-circle-o",
        "unanswered_color",
        isCorrect.filter(x => x === null).length,
        n
      );
    };
    
    questions = questions.map(json => {
      let cls;
      switch(json.type) {
        case "single_choice":
          cls = SingleChoice;
          break;
        case "multiple_choice":
          cls = MultipleChoice;
          break;
        case "ranking":
          cls = Ranking;
          break;
        case "classification":
          cls = Classification;
          break;
        default:
          throw "Unknown question type: " + json.type;
      }
      return new cls(wrapper, json);
    });
    questions.map(q => q.render());
    
    $(wrapper).append('<div class="stats"></div>');
    $(wrapper).append(
      '<div class="check">' +
        '<button>Vérifier</button>' +
      '</div>'
    );
    $(wrapper).find(".check button").click(check);
  };
})();
