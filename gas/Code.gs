// Google Apps Script Backend Code - PHIÊN BẢN HOÀN CHỈNH 2026 (Chạy 1 lần duy nhất)
// Spreadsheet cần có 4 sheets: devices, borrow_history, maintenance, users

const SPREADSHEET_ID = '1nx8m5V56l4lUifucf8ZXTYnDr-1BxEGPcWSnCT7VxDo'; 

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const action = e.parameter.action;
    let result;

    switch (action) {
      // --- Auth ---
      case 'login':
        const loginData = JSON.parse(e.postData.contents);
        result = login(loginData.email, loginData.password);
        break;

      // --- Devices ---
      case 'getDevices':
        result = getDevices();
        break;
      case 'getDevice':
        const getDeviceData = JSON.parse(e.postData.contents);
        result = getDevice(getDeviceData.id);
        break;
      case 'addDevice':
        result = addDevice(JSON.parse(e.postData.contents));
        break;
      case 'updateDevice':
        const updateData = JSON.parse(e.postData.contents);
        result = updateDevice(updateData.id, updateData);
        break;
      case 'deleteDevice':
        result = deleteDevice(JSON.parse(e.postData.contents).id);
        break;

      // --- Borrow ---
      case 'getBorrowHistory':
        result = getBorrowHistory();
        break;
      case 'getActiveBorrows':
        result = getActiveBorrows(JSON.parse(e.postData.contents).device_id);
        break;
      case 'borrowDevice':
        result = borrowDevice(JSON.parse(e.postData.contents));
        break;
      case 'returnDevice':
        result = returnDevice(JSON.parse(e.postData.contents));
        break;
      case 'returnMissing':
        result = returnMissing(JSON.parse(e.postData.contents));
        break;

      // --- Maintenance ---
      case 'getMaintenanceHistory':
        result = getMaintenanceHistory();
        break;
      case 'addMaintenance':
        result = addMaintenance(JSON.parse(e.postData.contents));
        break;

      // --- Rooms (QUẢN LÝ PHÒNG) ---
      case 'getRooms':
        result = getRooms();
        break;
      case 'addRoom':
        result = addRoom(JSON.parse(e.postData.contents));
        break;
      case 'updateRoom':
        const roomData = JSON.parse(e.postData.contents);
        result = updateRoom(roomData.id, roomData);
        break;
      case 'deleteRoom':
        result = deleteRoom(JSON.parse(e.postData.contents).id);
        break;

      // --- Dashboard ---
      case 'getDashboardStats':
        result = getDashboardStats(e.parameter.department);
        break;
      case 'getWeeklyUsageStats':
        result = getWeeklyUsageStats(e.parameter.department);
        break;
      
      // --- Users (QUẢN LÝ TÀI KHOẢN) ---
      case 'getUsers':
        result = getUsers();
        break;
      case 'addUser':
        result = addUser(JSON.parse(e.postData.contents));
        break;
      case 'updateUser':
        const userData = JSON.parse(e.postData.contents);
        result = updateUser(userData.id || userData.user_id, userData);
        break;
      case 'deleteUser':
        const delUserData = JSON.parse(e.postData.contents);
        result = deleteUser(delUserData.id || delUserData.user_id);
        break;
      case 'changePassword':
        const changePwData = JSON.parse(e.postData.contents);
        result = changePassword(changePwData.id || changePwData.user_id, changePwData.currentPassword, changePwData.newPassword);
        break;

      default:
        result = { error: 'Hành động không hợp lệ: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Helper: Đọc sheet thành mảng object ---
function sheetToObjects(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  // Columns that should always be treated as text (not dates)
  var textColumns = ['class', 'teacher', 'period', 'name', 'email', 'content', 'note', 'missing_note', 'description', 'technician', 'result', 'subject', 'room', 'department', 'managed_rooms', 'status', 'qr_code', 'created_by', 'password'];
  
  const objects = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; 
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const header = String(headers[j]).toLowerCase().trim();
      var val = row[j];
      // Convert Date objects to string to prevent auto-conversion issues
      if (val instanceof Date) {
        if (textColumns.indexOf(header) !== -1) {
          // For text columns, this was likely auto-converted by Sheets — return empty or just the text
          val = '';
        } else {
          val = val.toISOString();
        }
      }
      obj[header] = val;
    }
    objects.push(obj);
  }
  return objects;
}

// --- Helper: Tìm hàng theo ID ---
function findRowByIdInSheet(sheetName, id) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  
  // Tìm cột ID (hỗ trợ cả 'id', 'user_id', 'device_id')
  let idColIndex = headers.indexOf('id');
  if (idColIndex === -1) idColIndex = headers.indexOf('user_id');
  if (idColIndex === -1) idColIndex = headers.indexOf('device_id');
  if (idColIndex === -1) idColIndex = 0; // fallback to first column
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]) === String(id)) {
      return { sheet, rowIndex: i + 1, rowData: data[i], headers: headers };
    }
  }
  return null;
}

// --- Setup Ban Đầu ---
function initialSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Sheet: devices
  let sheet = ss.getSheetByName('devices');
  if (!sheet) sheet = ss.insertSheet('devices');
  sheet.getRange(1, 1, 1, 10).setValues([['id', 'name', 'subject', 'room', 'status', 'purchase_date', 'value', 'qr_code', 'quantity', 'created_by']]);
  
  // Sheet: borrow_history
  sheet = ss.getSheetByName('borrow_history');
  if (!sheet) sheet = ss.insertSheet('borrow_history');
  sheet.getRange(1, 1, 1, 13).setValues([['id', 'device_id', 'teacher', 'class', 'period', 'borrow_date', 'return_date', 'status', 'note', 'quantity', 'returned_qty', 'missing_qty', 'missing_note']]);
  
  // Sheet: maintenance
  sheet = ss.getSheetByName('maintenance');
  if (!sheet) sheet = ss.insertSheet('maintenance');
  sheet.getRange(1, 1, 1, 6).setValues([['id', 'device_id', 'date', 'content', 'technician', 'result']]);
  
  // Sheet: rooms
  sheet = ss.getSheetByName('rooms');
  if (!sheet) {
    sheet = ss.insertSheet('rooms');
    sheet.getRange(1, 1, 1, 4).setValues([['id', 'name', 'subject', 'description']]);
  }
  
  // Sheet: users
  sheet = ss.getSheetByName('users');
  if (!sheet) sheet = ss.insertSheet('users');
  if (sheet.getLastRow() < 2) {
    sheet.clear();
    sheet.getRange(1, 1, 1, 7).setValues([['id', 'email', 'password', 'name', 'role', 'department', 'managed_rooms']]);
    // Tài khoản Ban Giám Hiệu (Quyền Admin) mặc định
    sheet.appendRow(['U001', 'bgh@school.edu.vn', '123456', 'Ban Giám Hiệu', 'vice_principal', 'BGH', '']);
    sheet.appendRow(['U002', 'equipment@school.edu.vn', '123456', 'Cán bộ Thiết bị', 'equipment', 'Thiết bị', '']);
  }
  
  return { success: true, message: 'Khởi tạo hệ thống thành công!' };
}

// --- AUTH ---
function login(email, password) {
  var users = sheetToObjects('users');
  var user = users.find(function(u) {
    return String(u.email).toLowerCase() === String(email).toLowerCase() && String(u.password) === String(password);
  });

  if (!user) {
    throw new Error('Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại!');
  }
  
  // Normalize: đảm bảo luôn có field 'id' 
  var result = {};
  for (var key in user) {
    if (key === 'password') continue;
    result[key] = user[key];
  }
  // Map user_id -> id
  if (!result.id && result.user_id) {
    result.id = result.user_id;
  }
  return result;
}

// Hàm tự động sửa lỗi hoán đổi cột dữ liệu do version cũ
function repairUserData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('users');
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const emailIdx = headers.indexOf('email');
  const nameIdx = headers.indexOf('name');
  const passIdx = headers.indexOf('password');
  
  if (emailIdx === -1) return;

  let repaired = false;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let emailVal = String(row[emailIdx]);
    let nameVal = String(row[nameIdx]);
    let passVal = String(row[passIdx]);

    // Nếu cột Email không chứa @ nhưng cột Name hoặc Password lại chứa @
    // -> Đây là dấu hiệu bị hoán đổi
    if (!emailVal.includes('@')) {
      if (nameVal.includes('@')) {
        // Swap Email <-> Name
        sheet.getRange(i + 1, emailIdx + 1).setValue(nameVal);
        sheet.getRange(i + 1, nameIdx + 1).setValue(emailVal);
        repaired = true;
      } else if (passVal.includes('@')) {
        // Swap Email <-> Password
        sheet.getRange(i + 1, emailIdx + 1).setValue(passVal);
        sheet.getRange(i + 1, passIdx + 1).setValue(emailVal);
        repaired = true;
      }
    }
  }
  return repaired;
}

// --- DEVICES ---
function getDevices() {
  return sheetToObjects('devices');
}

function getDevice(id) {
  const devices = sheetToObjects('devices');
  const device = devices.find(d => String(d.id) === String(id));
  if (!device) throw new Error('Không tìm thấy thiết bị');
  return device;
}

function addDevice(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('devices');
  const id = 'TB' + new Date().getTime().toString().slice(-6);
  
  // Read headers to determine column positions
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).toLowerCase().trim());
  
  // Build data object with all fields
  const deviceData = {
    id: id,
    name: data.name || '',
    subject: data.subject || '',
    room: data.room || '',
    status: data.status || 'Tốt',
    purchase_date: new Date().toISOString().split('T')[0],
    value: data.value || 0,
    qr_code: id,
    quantity: parseInt(data.quantity) || 1,
    created_by: data.created_by || ''
  };
  
  // Auto-create missing columns
  var lastCol = headers.length;
  var allHeaders = headers.slice();
  for (var key in deviceData) {
    if (allHeaders.indexOf(key) === -1) {
      allHeaders.push(key);
      sheet.getRange(1, lastCol + 1).setValue(key);
      lastCol++;
    }
  }
  
  // Map data to correct column positions
  var newRow = new Array(allHeaders.length).fill('');
  for (var key in deviceData) {
    var colIdx = allHeaders.indexOf(key);
    if (colIdx !== -1) {
      newRow[colIdx] = deviceData[key];
    }
  }
  
  sheet.appendRow(newRow);
  return { success: true, id: id };
}

function updateDevice(id, updates) {
  const found = findRowByIdInSheet('devices', id);
  if (!found) throw new Error('Không tìm thấy thiết bị');
  
  const { sheet, rowIndex, headers, rowData } = found;
  var newRow = rowData.slice();
  var changed = false;
  var lastCol = headers.length;
  
  for (var key in updates) {
    var colKey = key.toLowerCase();
    if (colKey === 'id') continue;
    var colIndex = headers.indexOf(colKey);
    if (colIndex === -1) {
      // Auto-create missing column
      colIndex = lastCol++;
      sheet.getRange(1, colIndex + 1).setValue(colKey);
      headers.push(colKey);
      newRow.push(updates[key]);
      changed = true;
    } else {
      newRow[colIndex] = updates[key];
      changed = true;
    }
  }
  if (changed) {
    sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
  }
  return { success: true };
}

function deleteDevice(id) {
  const found = findRowByIdInSheet('devices', id);
  if (!found) throw new Error('Không tìm thấy thiết bị');
  found.sheet.deleteRow(found.rowIndex);
  return { success: true };
}

// --- BORROW ---
function getBorrowHistory() {
  return sheetToObjects('borrow_history');
}

// Lấy số lượng đang được mượn của 1 thiết bị
function getBorrowedQty(deviceId) {
  var history = sheetToObjects('borrow_history');
  var total = 0;
  for (var i = 0; i < history.length; i++) {
    var r = history[i];
    if (String(r.device_id) === String(deviceId) && (r.status === 'Đang mượn' || r.status === 'Trả thiếu')) {
      var qty = parseInt(r.quantity) || 1;
      var returned = parseInt(r.returned_qty) || 0;
      total += (qty - returned);
    }
  }
  return total;
}

// Lấy danh sách lượt mượn đang active của thiết bị
function getActiveBorrows(deviceId) {
  var history = sheetToObjects('borrow_history');
  var active = [];
  for (var i = 0; i < history.length; i++) {
    var r = history[i];
    if (String(r.device_id) === String(deviceId) && (r.status === 'Đang mượn' || r.status === 'Trả thiếu')) {
      active.push(r);
    }
  }
  return active;
}

function borrowDevice(data) {
  if (!data.device_id) throw new Error('Thiếu mã thiết bị');
  if (!data.teacher) throw new Error('Thiếu tên giáo viên');
  if (!data.class) throw new Error('Thiếu thông tin lớp');
  
  var devices = getDevices();
  var device = devices.find(function(d) { return String(d.id) === String(data.device_id); });
  if (!device) throw new Error('Không tìm thấy thiết bị');
  if (device.status === 'Hỏng') throw new Error('Thiết bị đang bị hỏng, không thể mượn');
  if (device.status === 'Cần bảo trì') throw new Error('Thiết bị cần bảo trì, không thể mượn');
  if (device.status === 'Hỏng nhẹ') throw new Error('Thiết bị bị hỏng nhẹ, không thể mượn');
  
  var totalQty = parseInt(device.quantity) || 1;
  var borrowedQty = getBorrowedQty(data.device_id);
  var availableQty = totalQty - borrowedQty;
  var requestQty = parseInt(data.quantity) || 1;
  
  if (requestQty > availableQty) {
    throw new Error('Không đủ số lượng. Còn ' + availableQty + '/' + totalQty + ' thiết bị');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var borrowSheet = ss.getSheetByName('borrow_history');
  var borrowId = 'BH' + new Date().getTime().toString().slice(-6);
  var now = new Date().toISOString();
  
  // Use header-based column mapping
  var headers = borrowSheet.getRange(1, 1, 1, borrowSheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  
  var borrowData = {
    borrow_id: borrowId,
    device_id: String(data.device_id),
    teacher: String(data.teacher),
    class: String(data.class),
    period: String(data.period || ''),
    borrow_date: now,
    return_date: '',
    status: 'Đang mượn',
    note: String(data.note || ''),
    quantity: requestQty,
    returned_qty: 0,
    missing_qty: 0,
    missing_note: ''
  };
  
  // Auto-create missing columns
  var lastCol = headers.length;
  var allHeaders = headers.slice();
  for (var key in borrowData) {
    if (allHeaders.indexOf(key) === -1) {
      allHeaders.push(key);
      borrowSheet.getRange(1, lastCol + 1).setValue(key);
      lastCol++;
    }
  }
  
  // Map data to correct column positions
  var newRow = new Array(allHeaders.length).fill('');
  for (var key in borrowData) {
    var colIdx = allHeaders.indexOf(key);
    if (colIdx !== -1) {
      newRow[colIdx] = borrowData[key];
    }
  }
  
  borrowSheet.appendRow(newRow);
  
  // Force text format on teacher, class, period columns
  var lastRow = borrowSheet.getLastRow();
  var teacherCol = allHeaders.indexOf('teacher') + 1;
  var classCol = allHeaders.indexOf('class') + 1;
  var periodCol = allHeaders.indexOf('period') + 1;
  if (teacherCol > 0 && classCol > 0 && periodCol > 0) {
    borrowSheet.getRange(lastRow, teacherCol).setNumberFormat('@');
    borrowSheet.getRange(lastRow, classCol).setNumberFormat('@').setValue(String(data.class));
    borrowSheet.getRange(lastRow, periodCol).setNumberFormat('@').setValue(String(data.period || ''));
  }
  
  // Cập nhật status nếu hết SL
  if (availableQty - requestQty <= 0) {
    updateDeviceStatus(data.device_id, 'Đang mượn');
  }
  return { success: true, id: borrowId, available: availableQty - requestQty };
}

function returnDevice(data) {
  if (!data.device_id) throw new Error('Thiếu mã thiết bị');
  if (!data.borrow_id) throw new Error('Thiếu mã lượt mượn');
  if (!data.teacher) throw new Error('Thiếu thông tin giáo viên');
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var borrowSheet = ss.getSheetByName('borrow_history');
  var now = new Date().toISOString();
  var borrowData = borrowSheet.getDataRange().getValues();
  var headers = borrowData[0].map(function(h) { return String(h).toLowerCase(); });
  
  var idCol = headers.indexOf('id');
  var teacherCol = headers.indexOf('teacher');
  var statusCol = headers.indexOf('status');
  var returnDateCol = headers.indexOf('return_date');
  var noteCol = headers.indexOf('note');
  var qtyCol = headers.indexOf('quantity');
  var returnedQtyCol = headers.indexOf('returned_qty');
  var missingQtyCol = headers.indexOf('missing_qty');
  var missingNoteCol = headers.indexOf('missing_note');
  
  // Auto-create missing columns if needed
  var lastCol = headers.length;
  if (returnedQtyCol === -1) {
    returnedQtyCol = lastCol++;
    borrowSheet.getRange(1, returnedQtyCol + 1).setValue('returned_qty');
  }
  if (missingQtyCol === -1) {
    missingQtyCol = lastCol++;
    borrowSheet.getRange(1, missingQtyCol + 1).setValue('missing_qty');
  }
  if (missingNoteCol === -1) {
    missingNoteCol = lastCol++;
    borrowSheet.getRange(1, missingNoteCol + 1).setValue('missing_note');
  }
  if (noteCol === -1) {
    noteCol = lastCol++;
    borrowSheet.getRange(1, noteCol + 1).setValue('note');
  }
  
  var foundRow = -1;
  for (var i = 1; i < borrowData.length; i++) {
    if (String(borrowData[i][idCol]) === String(data.borrow_id)) {
      foundRow = i;
      break;
    }
  }
  
  if (foundRow === -1) throw new Error('Không tìm thấy lượt mượn');
  
  var borrowTeacher = String(borrowData[foundRow][teacherCol]);
  var borrowStatus = String(borrowData[foundRow][statusCol]);
  
  if (borrowStatus !== 'Đang mượn' && borrowStatus !== 'Trả thiếu') {
    throw new Error('Lượt mượn này đã được trả');
  }
  
  // Kiểm tra đúng giáo viên
  if (borrowTeacher !== String(data.teacher)) {
    throw new Error('Chỉ ' + borrowTeacher + ' mới có thể trả thiết bị này');
  }
  
  var borrowedQty = parseInt(borrowData[foundRow][qtyCol]) || 1;
  var previousReturned = parseInt(borrowData[foundRow][returnedQtyCol]) || 0;
  var remaining = borrowedQty - previousReturned;
  var returnQty = parseInt(data.returned_qty) || remaining;
  var missingQty = parseInt(data.missing_qty) || 0;
  
  if (returnQty + missingQty > remaining) {
    throw new Error('Số lượng trả + thiếu không được lớn hơn ' + remaining);
  }
  
  var newReturnedTotal = previousReturned + returnQty;
  var newMissingTotal = (parseInt(borrowData[foundRow][missingQtyCol]) || 0) + missingQty;
  
  // Cập nhật borrow record
  borrowSheet.getRange(foundRow + 1, returnedQtyCol + 1).setValue(newReturnedTotal);
  borrowSheet.getRange(foundRow + 1, missingQtyCol + 1).setValue(newMissingTotal);
  
  if (data.missing_note) {
    var oldNote = borrowData[foundRow][missingNoteCol] || '';
    var newNote = oldNote ? oldNote + '; ' + data.missing_note : data.missing_note;
    borrowSheet.getRange(foundRow + 1, missingNoteCol + 1).setValue(newNote);
  }
  if (data.note) {
    borrowSheet.getRange(foundRow + 1, noteCol + 1).setValue(data.note);
  }
  
  if (newReturnedTotal + newMissingTotal >= borrowedQty) {
    // Đã trả hết (hoặc ghi nhận thiếu hết)
    borrowSheet.getRange(foundRow + 1, returnDateCol + 1).setValue(now);
    if (newMissingTotal > 0) {
      borrowSheet.getRange(foundRow + 1, statusCol + 1).setValue('Trả thiếu');
    } else {
      borrowSheet.getRange(foundRow + 1, statusCol + 1).setValue('Đã trả');
    }
  }
  
  // Cập nhật device status dựa trên tình trạng trả
  var validStatuses = ['Tốt', 'Hỏng nhẹ', 'Cần bảo trì', 'Hỏng'];
  var deviceStatus = validStatuses.includes(data.status) ? data.status : 'Tốt';
  var currentDevice = getDevice(data.device_id);
  var totalDeviceQty = parseInt(currentDevice.quantity) || 1;
  var stillBorrowed = getBorrowedQty(data.device_id);
  
  // Nếu trả mà báo hỏng/hỏng nhẹ/cần bảo trì → cập nhật device status ngay
  if (deviceStatus !== 'Tốt') {
    updateDeviceStatus(data.device_id, deviceStatus);
  } else if (stillBorrowed <= 0) {
    // Chỉ reset về Tốt khi tất cả đã trả VÀ trạng thái trả là Tốt
    updateDeviceStatus(data.device_id, 'Tốt');
  }
  
  // Nếu có thiết bị mất → giảm quantity trong sheet devices
  if (missingQty > 0) {
    var newTotalQty = totalDeviceQty - missingQty;
    if (newTotalQty < 0) newTotalQty = 0;
    updateDevice(data.device_id, { quantity: newTotalQty });
  }
  
  return { success: true, returned: returnQty, missing: missingQty };
}

// Trả nốt thiết bị thiếu
function returnMissing(data) {
  if (!data.borrow_id) throw new Error('Thiếu mã lượt mượn');
  if (!data.teacher) throw new Error('Thiếu thông tin giáo viên');
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var borrowSheet = ss.getSheetByName('borrow_history');
  var borrowData = borrowSheet.getDataRange().getValues();
  var headers = borrowData[0].map(function(h) { return String(h).toLowerCase(); });
  
  var idCol = headers.indexOf('id');
  var teacherCol = headers.indexOf('teacher');
  var statusCol = headers.indexOf('status');
  var returnDateCol = headers.indexOf('return_date');
  var returnedQtyCol = headers.indexOf('returned_qty');
  var missingQtyCol = headers.indexOf('missing_qty');
  var missingNoteCol = headers.indexOf('missing_note');
  var qtyCol = headers.indexOf('quantity');
  
  var foundRow = -1;
  for (var i = 1; i < borrowData.length; i++) {
    if (String(borrowData[i][idCol]) === String(data.borrow_id)) {
      foundRow = i;
      break;
    }
  }
  
  if (foundRow === -1) throw new Error('Không tìm thấy lượt mượn');
  if (String(borrowData[foundRow][statusCol]) !== 'Trả thiếu') throw new Error('Lượt mượn không ở trạng thái trả thiếu');
  if (String(borrowData[foundRow][teacherCol]) !== String(data.teacher)) {
    throw new Error('Chỉ ' + borrowData[foundRow][teacherCol] + ' mới có thể trả');
  }
  
  var returnQty = parseInt(data.returned_qty) || 0;
  var currentMissing = parseInt(borrowData[foundRow][missingQtyCol]) || 0;
  if (returnQty > currentMissing) throw new Error('Số lượng trả lại không được lớn hơn ' + currentMissing);
  
  var newMissing = currentMissing - returnQty;
  var newReturned = (parseInt(borrowData[foundRow][returnedQtyCol]) || 0) + returnQty;
  
  borrowSheet.getRange(foundRow + 1, returnedQtyCol + 1).setValue(newReturned);
  borrowSheet.getRange(foundRow + 1, missingQtyCol + 1).setValue(newMissing);
  
  if (data.note) {
    var oldNote = borrowData[foundRow][missingNoteCol] || '';
    borrowSheet.getRange(foundRow + 1, missingNoteCol + 1).setValue(oldNote + '; Trả lại: ' + data.note);
  }
  
  if (newMissing <= 0) {
    borrowSheet.getRange(foundRow + 1, statusCol + 1).setValue('Đã trả');
    borrowSheet.getRange(foundRow + 1, returnDateCol + 1).setValue(new Date().toISOString());
  }
  
  return { success: true, returned: returnQty, still_missing: newMissing };
}

function updateDeviceStatus(deviceId, status) {
  const found = findRowByIdInSheet('devices', deviceId);
  if (found) {
    const statusCol = found.headers.indexOf('status');
    if (statusCol !== -1) found.sheet.getRange(found.rowIndex, statusCol + 1).setValue(status);
  }
}

// --- MAINTENANCE ---
function getMaintenanceHistory() {
  return sheetToObjects('maintenance');
}

function addMaintenance(data) {
  if (!data.device_id) throw new Error('Thiếu mã thiết bị');
  if (!data.content) throw new Error('Thiếu nội dung bảo trì');
  
  // Validate device exists
  const devices = getDevices();
  const device = devices.find(d => String(d.id) === String(data.device_id));
  if (!device) throw new Error('Không tìm thấy thiết bị với mã: ' + data.device_id);
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('maintenance');
  const id = 'MH' + new Date().getTime().toString().slice(-6);
  sheet.appendRow([id, data.device_id, data.date || new Date().toISOString().split('T')[0], data.content, data.technician || '', data.result || 'Đã sửa']);
  return { success: true, id: id };
}

// --- ROOMS ---
function getRooms() {
  return sheetToObjects('rooms');
}

function addRoom(data) {
  if (!data.name) throw new Error('Thiếu tên phòng');
  if (!data.subject) throw new Error('Thiếu bộ môn/tổ');
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('rooms');
  if (!sheet) {
    sheet = ss.insertSheet('rooms');
    sheet.getRange(1, 1, 1, 4).setValues([['id', 'name', 'subject', 'description']]);
  }
  
  const id = 'R' + new Date().getTime().toString().slice(-6);
  sheet.appendRow([id, data.name, data.subject, data.description || '']);
  return { success: true, id: id };
}

function updateRoom(id, updates) {
  var found = findRowByIdInSheet('rooms', id);
  if (!found) throw new Error('Không tìm thấy phòng');
  
  var sheet = found.sheet, rowIndex = found.rowIndex, headers = found.headers, rowData = found.rowData;
  var newRow = rowData.slice();
  var changed = false;
  for (var key in updates) {
    if (key === 'id') continue;
    var colIndex = headers.indexOf(key.toLowerCase());
    if (colIndex !== -1) {
      newRow[colIndex] = updates[key];
      changed = true;
    }
  }
  if (changed) {
    sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
  }
  return { success: true };
}

function deleteRoom(id) {
  const found = findRowByIdInSheet('rooms', id);
  if (!found) throw new Error('Không tìm thấy phòng');
  found.sheet.deleteRow(found.rowIndex);
  return { success: true };
}

// --- DASHBOARD ---
function getDashboardStats(department) {
  let devices = getDevices();
  if (department) devices = devices.filter(d => d.subject === department);
  
  return {
    total: devices.length,
    borrowing: devices.filter(d => d.status === 'Đang mượn').length,
    broken: devices.filter(d => d.status === 'Hỏng' || d.status === 'Hỏng nhẹ').length,
    maintenance: devices.filter(d => d.status === 'Cần bảo trì').length
  };
}

function getWeeklyUsageStats(department) {
  const history = getBorrowHistory();
  const devices = getDevices();
  const filteredDevices = department ? devices.filter(d => d.subject === department) : devices;
  const deviceIds = new Set(filteredDevices.map(d => String(d.id)));
  const filteredHistory = history.filter(h => deviceIds.has(String(h.device_id)));
  
  // dayNames[0]=CN, [1]=T2, ..., [6]=T7
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const stats = dayNames.map(name => ({ name, borrow: 0, return: 0 }));
  
  filteredHistory.forEach(record => {
    if (record.borrow_date) {
      try {
        const borrowDay = new Date(record.borrow_date).getDay();
        stats[borrowDay].borrow++;
      } catch(e) {}
    }
    if (record.return_date) {
      try {
        const returnDay = new Date(record.return_date).getDay();
        stats[returnDay].return++;
      } catch(e) {}
    }
  });
  
  // Trả về T2-CN (bỏ CN đầu, thêm CN cuối)
  return [...stats.slice(1), stats[0]];
}

// ==========================================
// USERS (QUẢN LÝ TÀI KHOẢN)
// ==========================================
function getUsers() {
  const users = sheetToObjects('users');
  // Strip passwords before returning to frontend
  return users.map(function(u) {
    var userCopy = {};
    for (var key in u) {
      if (key !== 'password') {
        userCopy[key] = u[key];
      }
    }
    return userCopy;
  });
}

function addUser(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('users');
  
  // Đảm bảo có header nếu sheet trống
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 6).setValues([['user_id', 'name', 'email', 'password', 'role', 'department']]);
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).toLowerCase().trim());
  const id = data.id || data.user_id || 'U' + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMddHHmmss");
  
  // Chuẩn bị hàng mới dựa trên vị trí cột của header
  const newRow = new Array(headers.length).fill('');
  const userData = { ...data, id: id, user_id: id, password: data.password || '123456' };
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (userData[header] !== undefined) {
      newRow[i] = userData[header];
    }
  }
  
  sheet.appendRow(newRow);
  return { success: true, id: id };
}

function updateUser(id, updates) {
  var userId = id || (updates && updates.user_id);
  if (!userId) return { error: 'Thiếu ID người dùng' };
  
  var found = findRowByIdInSheet('users', userId);
  if (!found) return { error: 'Không tìm thấy người dùng với ID: ' + String(userId) };
  
  var sheet = found.sheet, rowIndex = found.rowIndex, headers = found.headers, rowData = found.rowData;
  var newRow = rowData.slice();
  var changed = false;
  var lastCol = headers.length;
  
  for (var key in updates) {
    var colKey = key.toLowerCase().trim();
    if (colKey === 'id' || colKey === 'user_id') continue;
    var colIndex = headers.indexOf(colKey);
    if (colIndex === -1) {
      // Auto-create missing column
      colIndex = lastCol++;
      sheet.getRange(1, colIndex + 1).setValue(colKey);
      headers.push(colKey);
      newRow.push(updates[key]);
      changed = true;
    } else {
      newRow[colIndex] = updates[key];
      changed = true;
    }
  }
  if (changed) {
    sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
  }
  return { success: true };
}

function deleteUser(id) {
  const found = findRowByIdInSheet('users', id);
  if (found) {
    found.sheet.deleteRow(found.rowIndex);
    return { success: true };
  }
  return { error: 'Không tìm thấy người dùng' };
}

// --- CHANGE PASSWORD (with verification) ---
function changePassword(id, currentPassword, newPassword) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('users');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const passIdx = headers.indexOf('password');
  
  // Tìm cột ID (hỗ trợ cả 'id' và 'user_id')
  let idColIndex = headers.indexOf('id');
  if (idColIndex === -1) idColIndex = headers.indexOf('user_id');
  if (idColIndex === -1) idColIndex = 0;
  
  if (passIdx === -1) throw new Error('Cấu trúc dữ liệu lỗi');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]) === String(id)) {
      const storedPassword = String(data[i][passIdx]);
      if (storedPassword !== String(currentPassword)) {
        throw new Error('Mật khẩu hiện tại không đúng');
      }
      sheet.getRange(i + 1, passIdx + 1).setValue(newPassword);
      return { success: true };
    }
  }
  throw new Error('Không tìm thấy người dùng');
}
