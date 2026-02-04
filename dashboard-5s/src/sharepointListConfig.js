// Source list:
// https://senzofab-my.sharepoint.com/personal/dashboard_monitoring_senzo_id/_layouts/15/listedit.aspx?List=%7B61DB5FBD%2D355D%2D4C4F%2DB38D%2D8A45CD546A60%7D
export const sharepointListConfig = {
  hostname: "senzofab-my.sharepoint.com",
  sitePath: "personal/dashboard_monitoring_senzo_id",
  listId: "61DB5FBD-355D-4C4F-B38D-8A45CD546A60",
  fieldMap: {
    "Sub Area": "field_1",
    "5S": "field_2",
    "Audit Score": "field_7",
    // NOTE: user-provided mapping; adjust if needed (Audit Remark may not be field_7).
    "Audit Remark": "field_7",
    "Follow Up Plan Date": "Follow_x0020_Up_x0020_Plan_x0020",
    "Follow Up Date": "field_10",
    "Follow Up Score": "field_12",
    "Follow Up Remark": "field_13",
    "Reference Photo": "Reference_x0020_Photo",
    "Audit Date": "field_17",
    "Created By": "Author",
    "Modified By": "Editor",
  },
};
