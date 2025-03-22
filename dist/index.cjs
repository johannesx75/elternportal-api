'use strict';

const axios = require('axios');
const axiosCookiejarSupport = require('axios-cookiejar-support');
const cheerio = require('cheerio');
const jsdom = require('jsdom');
const toughCookie = require('tough-cookie');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e; }

const axios__default = /*#__PURE__*/_interopDefaultCompat(axios);

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
async function getElternportalClient(config) {
  const apiclient = new ElternPortalApiClient(config);
  await apiclient.init();
  return apiclient;
}
class ElternPortalApiClient {
  constructor(config) {
    __publicField(this, "jar");
    __publicField(this, "client");
    __publicField(this, "short", "");
    __publicField(this, "username", "");
    __publicField(this, "password", "");
    __publicField(this, "kidId", 0);
    __publicField(this, "csrf", "");
    this.short = config.short;
    this.username = config.username;
    this.password = config.password;
    this.kidId = config.kidId || 0;
    this.jar = new toughCookie.CookieJar();
    this.client = axiosCookiejarSupport.wrapper(axios__default.create({ jar: this.jar }));
  }
  async init() {
    const { data } = await this.client.request({
      method: "GET",
      url: `https://${this.short}.eltern-portal.org/`
    });
    const $ = cheerio.load(data);
    const parsedCSRFToken = $(`[name='csrf']`).val();
    this.csrf = parsedCSRFToken;
    await this.setKid(this.kidId);
  }
  async setKid(kidId) {
    await this.client.request({
      method: "POST",
      url: `https://${this.short}.eltern-portal.org/includes/project/auth/login.php`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      data: {
        csrf: this.csrf,
        username: this.username,
        password: this.password,
        go_to: ""
      }
    });
    const response = await this.client.request({
      method: "POST",
      url: `https://${this.short}.eltern-portal.org/api/set_child.php?id=${kidId}`
    });
    if (response.data === 1) ;
  }
  /** list all kids in account */
  async getKids() {
    const { data } = await this.client.get(
      `https://${this.short}.eltern-portal.org/start`
    );
    const $ = cheerio.load(data);
    const kids = [];
    $("select.form-control option").each((_index, element) => {
      const id = parseInt($(element).attr("value") || "0");
      const accountRow = $(element).text().trim();
      const firstName = accountRow.split(" ")[0];
      const lastName = accountRow.split(" ")[1];
      const className = accountRow.split(" ")[2].replace("(", "").replace(")", "");
      kids.push({ id, firstName, lastName, className });
    });
    return kids;
  }
  /** get array of blackboard items */
  async getSchwarzesBrett(includeArchived = false) {
    const { data } = await this.client.get(
      `https://${this.short}.eltern-portal.org/aktuelles/schwarzes_brett`
    );
    const $ = cheerio.load(data);
    const posts = [];
    $(".container .grid-item").each((_index, element) => {
      const dateStart = $(element).find(".text-right").text().trim().replace("eingestellt am ", "").replace(" 00:00:00", "").replace(",,", '"');
      const title = $(element).find("h4").text().trim().replace(",,", '"');
      const content = this.htmlToPlainText(
        $(element).find("p:not(.text-right)").map((_i, el) => $(el).html()).get().join("<br>")
      );
      const link = $(element).find("a").attr("href");
      const id = parseInt(link?.split("repo=")[1].split("&")[0] ?? "0");
      posts.push({
        id: id == 0 ? this.getIdFromTitle(title) : id,
        dateStart,
        dateEnd: null,
        title,
        content,
        archived: false,
        link
      });
    });
    if (includeArchived) {
      $(".arch .well").each((_index, element) => {
        const link = $(element).find("a").attr("href");
        const id = parseInt(link?.split("?")[1].split("repo")[0] ?? "0");
        const title = $(element).find("h4").text().trim().replace(",,", '"');
        const content = $(element).find(".col-sm-9 p").text().replace(",,", '"');
        const dates = $(element).find(".col-md-2 p").text().trim().split(" - ");
        const dateStart = dates[0];
        const dateEnd = dates[1];
        posts.push({
          id,
          dateStart,
          dateEnd,
          title,
          content,
          archived: true,
          link
        });
      });
    }
    return posts;
  }
  /** get school infos as key value json array */
  async getSchoolInfos() {
    const { data } = await this.client.get(
      `https://${this.short}.eltern-portal.org/service/schulinformationen`
    );
    const $ = cheerio.load(data);
    $("table").remove();
    $(".hidden-lg").remove();
    let infos = $("#asam_content").html() || "".replaceAll(`
`, "<br>");
    const schoolInfos = cheerio.load(infos)(".row").get().map((ele) => {
      return {
        key: $(ele).find(".col-md-4").text(),
        value: $(ele).find(".col-md-6").html()
      };
    });
    return schoolInfos;
  }
  /** get termine of entire school */
  async getTermine(from = 0, to = 0) {
    const [param__from, param__to, utc_offset] = this.getFromAndToParams(
      from,
      to
    );
    const { data } = await this.client.request({
      method: "GET",
      url: `https://${this.short}.eltern-portal.org/api/ws_get_termine.php`,
      params: { from: param__from, to: param__to, utc_offset }
    });
    if (data.success === 1) {
      data.result = data.result.map((t) => {
        t.title = t.title.replaceAll("<br />", "<br>").replaceAll("<br>", "\n");
        t.title_short = t.title_short.replaceAll("<br />", "<br>").replaceAll("<br>", "\n");
        t.startDate = new Date(parseInt(t.start));
        t.endDate = new Date(parseInt(t.end));
        t.bo_end = parseInt(t.bo_end);
        t.id = parseInt(t.id.replace("id_", ""));
        return t;
      });
      data.result = data.result.filter((t) => t.start >= param__from);
      data.result = data.result.filter((t) => t.end <= param__to);
      return data.result;
    }
    return [];
  }
  async getSchulaufgabenplan() {
    const { data } = await this.client.request({
      method: "GET",
      url: `https://${this.short}.eltern-portal.org/service/termine/liste/schulaufgaben#10`
    });
    const $ = cheerio.load(data);
    const schulaufgaben = [];
    $(".container #asam_content .row .no_padding_md .table2 tbody tr").each(
      (index, element) => {
        const datum = $(element).find("td").eq(0).text().trim();
        const titel = $(element).find("td").eq(2).text().trim();
        if (titel && datum) {
          const schaulaufgabe = {
            id: this.getIdFromTitle(titel),
            title: titel,
            date: this.toDate(datum)
          };
          schulaufgaben.push(schaulaufgabe);
        }
      }
    );
    return schulaufgaben;
  }
  getFromAndToParams(from = 0, to = 0) {
    const now = Date.now();
    const utc_offset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
    let param__from = from;
    if (param__from === 0) {
      param__from = now;
    }
    let param__to = to;
    if (param__to === 0) {
      param__to = now + 1e3 * 60 * 60 * 24 * 90;
    }
    if (`${from}`.length !== 13) {
      param__from = parseInt(`${param__from}`.padEnd(13, "0"));
    }
    if (`${to}`.length !== 13) {
      param__to = parseInt(`${param__to}`.padEnd(13, "0"));
    }
    return [param__from, param__to, utc_offset];
  }
  /** get timetable of currently selected kid */
  async getStundenplan() {
    const { data } = await this.client.get(
      `https://${this.short}.eltern-portal.org/service/stundenplan`
    );
    const $ = cheerio.load(data);
    const tmp = $("#asam_content > div > table > tbody tr td");
    let rows = [];
    let std = 0;
    tmp.each((_index, element) => {
      $(element).find("br").replaceWith("\n");
      const values = $(element).text().split("\n");
      if ($(element).attr("width") == "15%") {
        const value = parseInt(values[0]);
        std = value;
        const detail = (values[1] || "").replaceAll(".", ":");
        rows.push({ type: "info", value, detail, std });
      } else {
        const value = values[0] || "";
        const detail = values[1] || "";
        rows.push({ type: "class", value, detail, std });
      }
    });
    rows = rows.filter((r) => r.std !== null);
    return rows;
  }
  /** Returns HTML Markup of a page */
  async getRawContent(endpoint) {
    const { data } = await this.client.request({
      method: "GET",
      url: `https://${this.short}.eltern-portal.org/` + endpoint
    });
    const $ = cheerio.load(data);
    return $(`#asam_content`).html() ?? "";
  }
  /** get substitutions */
  async getVertretungsplan() {
    const { data } = await this.client.request({
      method: "GET",
      url: `https://${this.short}.eltern-portal.org/service/vertretungsplan`
    });
    const $ = cheerio.load(data);
    const lastUpdate = $('div.main_center div:contains("Stand:")').text();
    const dateTimeMatch = lastUpdate.match(/Stand:\s(\d{2}\.\d{2}\.\d{4})\s(\d{2}:\d{2}:\d{2})/);
    let jsDate = void 0;
    if (dateTimeMatch) {
      const [_, datePart, timePart] = dateTimeMatch;
      const [day, month, year] = datePart.split(".").map(Number);
      const [hours, minutes, seconds] = timePart.split(":").map(Number);
      jsDate = new Date(year, month - 1, day, hours, minutes, seconds);
    }
    const vertretungsplan = {
      lastUpdate: jsDate,
      substitutions: []
    };
    $('div.main_center div.list.bold:contains("KW")').each((_index, element) => {
      const $element = $(element);
      const datestring = $element.text();
      const match = datestring.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (!match || match.length != 4) {
        return false;
      }
      const substitutionDate = new Date(+match[3], +match[2], +match[1]);
      const table = $element.next();
      if (!table.is("table")) {
        return false;
      }
      if (table.has("tr:nth-child(2) td[align=center]:contains(Keine Vertretungen)").length > 0) {
        return false;
      }
      table.find("tr:not(.vp_plan_head)").each((_index2, element2) => {
        const $element2 = $(element2);
        vertretungsplan.substitutions.push({
          date: substitutionDate,
          period: Number.parseInt($element2.find("td:nth-child(1)").text()),
          originalTeacher: $element2.find("td:nth-child(2)").text(),
          substituteTeacher: $element2.find("td:nth-child(3)").text(),
          substituteClass: $element2.find("td:nth-child(4) span").text().trim(),
          originalClass: $element2.find("td:nth-child(4) span").remove().text().trim(),
          room: $element2.find("td:nth-child(5)").text(),
          note: $element2.find("td:nth-child(6)").text()
        });
      });
    });
    return vertretungsplan;
  }
  /** get lost and found items */
  async getFundsachen() {
    const { data } = await this.client.get(
      `https://${this.short}.eltern-portal.org/suche/fundsachen`
    );
    const $ = cheerio.load(data);
    $("table").remove();
    $(".hidden-lg").remove();
    let fundsachenhtml = $("#asam_content").html().replaceAll(
      `
`,
      "<br>"
    );
    const fundsachen = cheerio.load(fundsachenhtml)(".row").get().map((ele) => {
      return $(ele).find(".caption").text();
    }).filter((f) => f.trim());
    return fundsachen;
  }
  /** get parents letters */
  async getElternbriefe() {
    const { data } = await this.client.get(
      `https://${this.short}.eltern-portal.org/aktuelles/elternbriefe`
    );
    const $ = cheerio.load(data);
    $(".hidden-lg").remove();
    let tmp = $("tr").get().map((ele) => {
      if ($(ele).find("td:first").html().includes("<h4>")) {
        const readConfirmationStringId = $(ele).find("a").attr("onclick")?.match(/eb_bestaetigung\((\d+)\)/)[1] ?? void 0;
        const readConfirmationId = readConfirmationStringId ? parseInt(readConfirmationStringId) : void 0;
        const title = $(ele).find("td:first a h4").text();
        $(ele).remove("h4");
        const messageText = $(ele).find("td:first").clone().children().remove().end().text().trim();
        const classes = $(ele).find("span[style='font-size: 8pt;']").text().replace("Klasse/n: ", "");
        const link = $(ele).find("td:first a").attr("href");
        const date = $(ele).find("td:first a").text().replace(`${title} `, "");
        $(ele).remove("a");
        return {
          readConfirmationId,
          title,
          messageText,
          classes,
          date,
          link
        };
      }
      const statusOriginal = $(ele).find("td:last").html();
      let status = "read";
      if (statusOriginal.includes("noch nicht")) {
        status = "unread";
      }
      return {
        id: $(ele).find("td:first").html(),
        status
      };
    });
    let briefe = [];
    for (let index = 0; index < tmp.length; index += 2) {
      briefe.push({
        id: parseInt(tmp[index].id.replace("#", "")),
        readConfirmationId: tmp[index + 1].readConfirmationId,
        status: tmp[index].status ?? "unread",
        title: tmp[index + 1].title ?? "",
        messageText: tmp[index + 1].messageText ?? "",
        classes: tmp[index + 1].classes ?? "",
        date: tmp[index + 1].date ?? "",
        link: tmp[index + 1].link ?? ""
      });
    }
    return briefe;
  }
  async getSchwarzesBrettFile(id) {
    const schwarzesBrett = await this.getSchwarzesBrett();
    const entry = schwarzesBrett.find((entry2) => entry2.id === id);
    if (!entry || !entry.link) {
      throw new Error("File from Schwarzesbrett not found");
    }
    const buffer = await this.getFileBuffer(entry?.link ?? "");
    const file = {
      name: entry.title,
      buffer
    };
    return file;
  }
  async getElternbrief(id, validateElternbriefReceipt = true) {
    const elternbriefe = await this.getElternbriefe();
    const brief = elternbriefe.find((brief2) => brief2.id === id);
    if (!brief || !brief.link) {
      throw new Error("Elternbrief not found");
    }
    const buffer = await this.getFileBuffer(brief?.link ?? "");
    if (validateElternbriefReceipt) {
      await this.validateElternbriefReceipt(brief);
    }
    const file = {
      name: brief.title,
      buffer
    };
    return file;
  }
  async validateElternbriefReceipt(elternbrief) {
    if (elternbrief.readConfirmationId) {
      await this.client.get(
        `https://${this.short}.eltern-portal.org/api/elternbrief_bestaetigen.php?eb=${elternbrief.readConfirmationId}`
      );
    }
  }
  async getFileBuffer(link) {
    const downloadUrl = `https://${this.short}.eltern-portal.org/${link}`;
    const response = await this.client.get(downloadUrl, {
      responseType: "arraybuffer"
    });
    const buffer = Buffer.from(response.data, "binary");
    return buffer;
  }
  getIdFromTitle(title) {
    let hash = 5381;
    for (let i = 0; i < title.length; i++) {
      hash = hash * 33 ^ title.charCodeAt(i);
    }
    return hash >>> 0;
  }
  toDate(dateString) {
    const [day, month, year] = dateString.split(".").map(Number);
    return new Date(year, month - 1, day);
  }
  // timestamp to date
  timestampToDate(timestamp) {
    return new Date(timestamp);
  }
  htmlToPlainText(html) {
    const dom = new jsdom.JSDOM(html);
    return dom.window.document.body.textContent || "";
  }
}

exports.ElternPortalApiClient = ElternPortalApiClient;
exports.getElternportalClient = getElternportalClient;
