export const OFFICIAL_SELECTOR_MANIFESTS = {
  taipei: {
    jurisdiction: "taipei",
    officialUrl: "https://prsweb.tcpd.gov.tw/",
    observedAt: "2026-06-16",
    evidence: {
      entryRoute: "/",
      reportRoute: "/New",
      sourceType: "vue_bundle",
      sourceFiles: [
        "js/index.5b794fe9.js",
        "js/chunk-b2f5649e.33aff5f1.js",
      ],
    },
    routes: {
      home: "/",
      newReport: "/New",
      search: "/Search",
      emailVerification: "/Mail/:id",
      correction: "/Fix/:id/:pass",
    },
    apiEndpoints: [
      "home/GetMail",
      "home/CheckMail",
      "home/GetZip",
      "home/getRoad",
      "home/GetPubrul",
      "home/setcase",
    ],
    fields: {
      "reporter.identityNumber": {
        selector: "#sPub_id",
        name: "sPub_id",
        label: "身分證/居留證",
        phase: "before_email",
      },
      "reporter.name": {
        selector: "#sPub_nm",
        name: "sPub_nm",
        label: "姓名",
        phase: "before_email",
      },
      "reporter.phone": {
        selector: "#sPubtel",
        name: "sPubtel",
        label: "聯絡電話",
        phase: "before_email",
      },
      "reporter.phoneExtension": {
        selector: "[name='sPubtelExt']",
        name: "sPubtelExt",
        label: "聯絡電話(分機)",
        phase: "before_email",
      },
      "reporter.address": {
        selector: "#sPubadd",
        name: "sPubadd",
        label: "地址",
        phase: "before_email",
      },
      "reporter.email": {
        selector: "#email",
        name: "email",
        label: "電子信箱",
        phase: "before_email",
      },
      "case.date": {
        vueModel: "vilcase.vildate",
        label: "違規時間",
        phase: "after_email",
      },
      "case.time": {
        vueModel: "vilcase.viltime",
        label: "違規時間",
        phase: "after_email",
      },
      "case.plateType": {
        vueModel: "vilcase.carType",
        label: "違規車號",
        phase: "after_email",
      },
      "case.platePrefix": {
        vueModel: "vilcase.plate1",
        label: "違規車號",
        phase: "after_email",
      },
      "case.plateSuffix": {
        vueModel: "vilcase.plate2",
        label: "違規車號",
        phase: "after_email",
      },
      "case.district": {
        vueModel: "vilcase.sVilzp1",
        label: "違規地點",
        phase: "after_email",
      },
      "case.road": {
        vueModel: "vilcase.sVilad1",
        label: "違規地點",
        phase: "after_email",
      },
      "case.addressNote": {
        selector: "#sViladd",
        vueModel: "vilcase.sViladd",
        label: "地點備註",
        phase: "after_email",
      },
      "case.fact": {
        vueModel: "vilcase.sPubrul",
        label: "違規事實",
        phase: "after_email",
      },
      "case.description": {
        selector: "#sRuldec",
        vueModel: "vilcase.sRuldec",
        label: "違規事實說明",
        phase: "after_email",
      },
      attachments: {
        selector: "input[type='file'][multiple]",
        accept: ".jpg,.jpeg,.png,.bmp,.tiff,.mp4,.mov,.wmv,.avi,.3gp,.ts",
        phase: "after_email",
      },
    },
    humanStops: {
      emailVerification: {
        action: "send_email_verification",
        triggerText: "發送認證信",
        endpoint: "home/GetMail",
      },
      declarations: {
        selector: "#checkbox input[type='checkbox']",
        labelIncludes: "個人資料收集聲明及服務條款",
      },
      finalSubmit: {
        forbiddenSelector: "button",
        forbiddenText: "送出",
        endpoint: "home/setcase",
      },
    },
  },
  new_taipei: {
    jurisdiction: "new_taipei",
    officialUrl: "https://tvrs.ntpd.gov.tw/",
    observedAt: "2026-06-16",
    evidence: {
      entryRoute: "/",
      disclaimerRoute: "/Home/Report",
      reportRoute: "/Home/Report_Add",
      sourceType: "server_rendered_html",
    },
    routes: {
      home: "/",
      disclaimer: "/Home/Report",
      newReport: "/Home/Report_Add",
      search: "/Home/Search",
      correction: "/Home/Correction_Recognition",
    },
    apiEndpoints: [
      "/AJAX/CheckValid",
      "/AJAX/mailcheck",
      "/Home/GetEmailCheck",
      "/Home/Report_Add",
    ],
    fields: {
      "case.vehicleType": {
        selector: "#eventsData_vio_type_code",
        name: "eventsData.vio_type_code",
        label: "違規類型",
      },
      "case.plateType": {
        selector: "#eventsData_CarNumberType_code",
        name: "eventsData.CarNumberType_code",
        label: "車牌類型",
      },
      "case.platePrefix": {
        selector: "#vio_car_num1",
        name: "vio_car_num1",
        label: "違規車號",
      },
      "case.plateSuffix": {
        selector: "#vio_car_num2",
        name: "vio_car_num2",
        label: "違規車號",
      },
      "case.date": {
        selector: "#eventsData_vio_date",
        name: "eventsData.vio_date",
        label: "違規日期",
      },
      "case.hour": {
        selector: "#eventsData_vio_hour",
        name: "eventsData.vio_hour",
        label: "違規時間(時)",
      },
      "case.minute": {
        selector: "#eventsData_vio_min",
        name: "eventsData.vio_min",
        label: "違規時間(分)",
      },
      "case.cityScope": {
        selector: "#eventsData_isArea",
        name: "eventsData.isArea",
        label: "違規地點縣市",
      },
      "case.district": {
        selector: "#eventsData_dist_code",
        name: "eventsData.dist_code",
        label: "違規地點行政區",
      },
      "case.road": {
        selector: "#eventsData_road_code",
        name: "eventsData.road_code",
        label: "違規地點街道",
      },
      "case.addressNote": {
        selector: "#eventsData_custom_addr",
        name: "eventsData.custom_addr",
        label: "補充地點",
      },
      "case.fact": {
        selector: "#eventsData_vio_content_code",
        name: "eventsData.vio_content_code",
        label: "違規事實",
      },
      "case.description": {
        selector: "#eventsData_vio_content_memo",
        name: "eventsData.vio_content_memo",
        label: "其他違規事實",
      },
      attachments: {
        selector: "input[name^='upfile']",
        namePrefix: "upfile",
        accept: "jpg,jpeg,gif,png,mp4,flv,mpeg,mkv,mov,avi,wmv,zip,rar,ts",
      },
      "reporter.identityType": {
        selector: "input[name='informerData.isForeigner']",
        name: "informerData.isForeigner",
        label: "身分別",
      },
      "reporter.identityNumber": {
        selector: "#informerData_identity",
        name: "informerData.identity",
        label: "身分證",
      },
      "reporter.name": {
        selector: "#informerData_informer_name",
        name: "informerData.informer_name",
        label: "姓名",
      },
      "reporter.address": {
        selector: "#informerData_contact_address",
        name: "informerData.contact_address",
        label: "聯絡地址",
      },
      "reporter.phone": {
        selector: "#informerData_Phone",
        name: "informerData.Phone",
        label: "聯絡電話",
      },
      "reporter.email": {
        selector: "#informerData_Email",
        name: "informerData.Email",
        label: "Email",
      },
    },
    humanStops: {
      disclaimer: {
        selector: "#ck",
        nextButtonSelector: ".btn-next",
        labelIncludes: "我已閱讀並同意以上免責權聲明",
      },
      captcha: {
        selector: "#VaildCode",
        endpoint: "/AJAX/CheckValid",
      },
      emailVerification: {
        selector: ".vaild_btn",
        endpoint: "/Home/GetEmailCheck",
      },
      finalSubmit: {
        forbiddenSelector: ".submit_btn",
        endpoint: "/Home/Report_Add",
      },
    },
  },
};

const REQUIRED_FIELD_KEYS = {
  taipei: [
    "reporter.identityNumber",
    "reporter.name",
    "reporter.phone",
    "reporter.address",
    "reporter.email",
    "case.date",
    "case.time",
    "case.platePrefix",
    "case.plateSuffix",
    "case.district",
    "case.road",
    "case.addressNote",
    "case.fact",
    "case.description",
    "attachments",
  ],
  new_taipei: [
    "case.vehicleType",
    "case.plateType",
    "case.platePrefix",
    "case.plateSuffix",
    "case.date",
    "case.hour",
    "case.minute",
    "case.cityScope",
    "case.district",
    "case.road",
    "case.addressNote",
    "case.fact",
    "attachments",
    "reporter.identityType",
    "reporter.identityNumber",
    "reporter.name",
    "reporter.address",
    "reporter.phone",
    "reporter.email",
  ],
};

const REQUIRED_STOP_KEYS = {
  taipei: ["emailVerification", "declarations", "finalSubmit"],
  new_taipei: ["disclaimer", "captcha", "emailVerification", "finalSubmit"],
};

export function getOfficialSelectorManifest(jurisdiction) {
  const manifest = OFFICIAL_SELECTOR_MANIFESTS[jurisdiction];
  if (!manifest) {
    throw new Error(`Unsupported selector manifest jurisdiction: ${jurisdiction}`);
  }
  return manifest;
}

export function validateSelectorManifest(jurisdiction) {
  const manifest = getOfficialSelectorManifest(jurisdiction);
  const missingFields = REQUIRED_FIELD_KEYS[jurisdiction].filter((key) => !manifest.fields[key]);
  const missingStops = REQUIRED_STOP_KEYS[jurisdiction].filter((key) => !manifest.humanStops[key]);
  const fieldsWithoutLocator = Object.entries(manifest.fields)
    .filter(([, value]) => !value.selector && !value.vueModel)
    .map(([key]) => key);

  return {
    jurisdiction,
    observedAt: manifest.observedAt,
    officialUrl: manifest.officialUrl,
    status: missingFields.length === 0 && missingStops.length === 0 && fieldsWithoutLocator.length === 0
      ? "ok"
      : "needs_update",
    sourceType: manifest.evidence.sourceType,
    routeCount: Object.keys(manifest.routes).length,
    fieldCount: Object.keys(manifest.fields).length,
    stopCount: Object.keys(manifest.humanStops).length,
    missingFields,
    missingStops,
    fieldsWithoutLocator,
    finalSubmitBlocked: Boolean(manifest.humanStops.finalSubmit),
  };
}
