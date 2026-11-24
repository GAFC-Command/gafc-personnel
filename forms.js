/* Form definitions. Field names match the fillable PDFs. */
(function (g) {
  var demo = function (dateLabel, dateName) {
    return [
      { k: "bar", text: "1.  DEMOGRAPHIC INFORMATION" },
      { k: "row", fields: [
        { l: "Unit", n: "unit", w: 3 },
        { l: dateLabel, n: dateName, w: 1.3, date: true, today: true }
      ] }
    ];
  };

  var FORMS = {
    counseling: {
      key: "counseling",
      tab: "Counseling",
      heading: "COUNSELING FORM",
      sub: "Disciplinary / Developmental Counseling Statement",
      file: "Counseling_Form",
      nameField: "soldier_name",
      items: [].concat(demo("Date of Counseling", "counseling_date"), [
        { k: "sub", text: "SOLDIER BEING COUNSELED" },
        { k: "row", fields: [
          { l: "Rank", n: "soldier_rank", w: 1 },
          { l: "Gamertag", n: "soldier_name", w: 2.6 },
          { l: "Discord ID Number", n: "soldier_discord_id", w: 1.8, inputmode: "numeric" }
        ] },
        { k: "sub", text: "PERSON COMPLETING THIS FORM" },
        { k: "row", fields: [
          { l: "Rank", n: "counselor_rank", w: 1 },
          { l: "Gamertag", n: "counselor_name", w: 2.6 },
          { l: "Position / Billet", n: "counselor_position", w: 1.8 }
        ] },
        { k: "bar", text: "2.  INFRACTION" },
        { k: "row", fields: [
          { l: "Article / Regulation / Paragraph (e.g., AR 670-1, para 1-8)", n: "infraction_article", w: 3 },
          { l: "Date of Infraction", n: "infraction_date", w: 1.3, date: true }
        ] },
        { k: "area", l: "Description of infraction (who, what, where, when)", n: "infraction_description", h: 72 },
        { k: "bar", text: "3.  CORRECTIVE ACTION TAKEN" },
        { k: "checks", cols: 3, items: [
          ["PT (physical training)", "ca_pt"],
          ["Extra duty", "ca_extra_duty"],
          ["Referred to higher command", "ca_referred"],
          ["Retraining *", "ca_retraining"],
          ["Loss of privileges *", "ca_privileges"],
          ["Reduction in rank *", "ca_demotion"]
        ] },
        { k: "other", l: "Other (specify):", cb: "ca_other", tn: "ca_other_text" },
        { k: "note", text: "*  Requires commander approval (see Section 6)." },
        { k: "area", l: "Details of corrective action and expected improvement", n: "corrective_details", h: 56 },
        { k: "bar", text: "4.  SOLDIER ACKNOWLEDGMENT" },
        { k: "checks", cols: 2, exclusive: true, items: [
          ["I agree with the information above", "sm_agree"],
          ["I disagree with the information above", "sm_disagree"]
        ] },
        { k: "area", l: "Soldier comments (required if you disagree)", n: "sm_comments", h: 32 },
        { k: "row", h: 20, fields: [
          { l: "Soldier Signature (type full name or sign after printing)", n: "sm_signature", w: 3, sig: true },
          { l: "Date", n: "sm_signature_date", w: 1, date: true }
        ] },
        { k: "bar", text: "5.  FIRST LINE LEADER" },
        { k: "row", h: 20, fields: [
          { l: "FLL Name and Rank", n: "fll_name", w: 2 },
          { l: "FLL Signature (type full name or sign after printing)", n: "fll_signature", w: 3, sig: true },
          { l: "Date", n: "fll_signature_date", w: 1, date: true }
        ] },
        { k: "bar", text: "6.  COMMANDER APPROVAL  (required for any action marked *)" },
        { k: "row", h: 20, fields: [
          { l: "Commander Name and Rank", n: "cmdr_name", w: 2 },
          { l: "Commander Signature (type full name or sign after printing)", n: "cmdr_signature", w: 3, sig: true },
          { l: "Date", n: "cmdr_signature_date", w: 1, date: true }
        ] }
      ])
    },

    award: {
      key: "award",
      tab: "Award recommendation",
      heading: "AWARD / COMMENDATION RECOMMENDATION",
      sub: "First Line Leader Recommendation for Recognition",
      file: "Award_Recommendation",
      nameField: "soldier_name",
      items: [
        { k: "bar", text: "1.  DEMOGRAPHIC INFORMATION" },
        { k: "row", fields: [
          { l: "Unit", n: "unit", w: 3 },
          { l: "Date of Recommendation", n: "recommendation_date", w: 1.3, date: true, today: true }
        ] },
        { k: "sub", text: "SOLDIER BEING RECOMMENDED" },
        { k: "row", fields: [
          { l: "Rank", n: "soldier_rank", w: 1 },
          { l: "Gamertag", n: "soldier_name", w: 2.6 },
          { l: "Discord ID Number", n: "soldier_discord_id", w: 1.8, inputmode: "numeric" }
        ] },
        { k: "sub", text: "RECOMMENDING FIRST LINE LEADER" },
        { k: "row", fields: [
          { l: "Rank", n: "fll_rank", w: 1 },
          { l: "Gamertag", n: "fll_name", w: 2.6 },
          { l: "Position / Billet", n: "fll_position", w: 1.8 }
        ] },
        { k: "bar", text: "2.  RECOMMENDED RECOGNITION" },
        { k: "checks", cols: 3, items: [
          ["Letter of Commendation", "rec_commendation"],
          ["Certificate of Achievement", "rec_achievement"],
          ["Certificate of Appreciation", "rec_appreciation"],
          ["Medal / Ribbon", "rec_medal"],
          ["Promotion recommendation", "rec_promotion"],
          ["Special privilege / duty assignment", "rec_privilege"]
        ] },
        { k: "other", l: "Other (specify):", cb: "rec_other", tn: "rec_other_text" },
        { k: "row", fields: [
          { l: "Specific award, medal, or promotion requested (if known)", n: "rec_specific", w: 3 },
          { l: "Date(s) of act or period of service", n: "rec_dates", w: 1.6 }
        ] },
        { k: "bar", text: "3.  JUSTIFICATION" },
        { k: "area", l: "Description of achievement or conduct (who, what, where, when)", n: "justification", h: 76 },
        { k: "area", l: "Impact on the unit or mission", n: "impact", h: 46 },
        { k: "area", l: "Supporting evidence (clips, screenshots, event logs, witnesses)", n: "evidence", h: 30 },
        { k: "bar", text: "4.  FIRST LINE LEADER RECOMMENDATION" },
        { k: "text", text: "I recommend the soldier named above for the recognition selected in Section 2." },
        { k: "row", h: 20, fields: [
          { l: "FLL Name and Rank", n: "fll_sig_name", w: 2 },
          { l: "FLL Signature (type full name or sign after printing)", n: "fll_signature", w: 3, sig: true },
          { l: "Date", n: "fll_signature_date", w: 1, date: true }
        ] },
        { k: "bar", text: "5.  COMMANDER DECISION" },
        { k: "checks", cols: 3, exclusive: true, items: [
          ["Approved", "cmdr_approved"],
          ["Approved with changes", "cmdr_modified"],
          ["Disapproved", "cmdr_disapproved"]
        ] },
        { k: "area", l: "Commander comments / award granted", n: "cmdr_comments", h: 32 },
        { k: "row", h: 20, fields: [
          { l: "Commander Name and Rank", n: "cmdr_name", w: 2 },
          { l: "Commander Signature (type full name or sign after printing)", n: "cmdr_signature", w: 3, sig: true },
          { l: "Date", n: "cmdr_signature_date", w: 1, date: true }
        ] }
      ]
    }
  };

  g.FORMS = FORMS;
  if (typeof module !== "undefined" && module.exports) module.exports = FORMS;
})(typeof globalThis !== "undefined" ? globalThis : window);
