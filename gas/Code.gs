// Google Apps Script Backend Code - HỆ THỐNG QUẢN LÝ MƯỢN TRẢ 2026
// Spreadsheet cần có 6 sheets: devices, borrow_history, maintenance, users, books, book_borrows

const SPREADSHEET_ID = '1LH76Ru-UHO09He6E7FX9u5_0Rit5QJ7__UWj83YojYM'; 

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
      case 'approveDeviceBorrow': return approveDeviceBorrow(data);
      case 'rejectDeviceBorrow': return rejectDeviceBorrow(data);
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
      case 'updateMaintenanceResult':
        result = updateMaintenanceResult(JSON.parse(e.postData.contents));
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

      // --- Books (THƯ VIỆN) ---
      case 'getBooks':
        result = getBooks();
        break;
      case 'addBook':
        result = addBook(JSON.parse(e.postData.contents));
        break;
      case 'updateBook':
        var updateBookData = JSON.parse(e.postData.contents);
        result = updateBook(updateBookData.id, updateBookData);
        break;
      case 'deleteBook':
        result = deleteBook(JSON.parse(e.postData.contents).id);
        break;
      case 'borrowBook':
        result = borrowBook(JSON.parse(e.postData.contents));
        break;
      case 'borrowMultipleBooks':
        result = borrowMultipleBooks(JSON.parse(e.postData.contents));
        break;
      case 'returnBook':
        result = returnBookFn(JSON.parse(e.postData.contents));
        break;
      case 'getBookBorrowHistory':
        result = getBookBorrowHistory();
        break;
      case 'getBookStats':
        result = getBookStats();
        break;

      case 'approveBookBorrow':
        result = approveBookBorrow(JSON.parse(e.postData.contents));
        break;
      case 'rejectBookBorrow':
        result = rejectBookBorrow(JSON.parse(e.postData.contents));
        break;

      // --- Upload Photo ---
      case 'uploadPhoto':
        result = uploadPhoto(JSON.parse(e.postData.contents));
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
  var textColumns = ['class', 'teacher', 'period', 'name', 'email', 'content', 'note', 'missing_note', 'description', 'technician', 'result', 'subject', 'room', 'department', 'managed_rooms', 'status', 'qr_code', 'created_by', 'password', 'date_of_birth', 'class_group', 'gender', 'photo_url'];
  
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
          // For text columns like date_of_birth, format Date as DD/MM/YYYY
          var dd = String(val.getDate()).padStart(2, '0');
          var mm = String(val.getMonth() + 1).padStart(2, '0');
          var yyyy = val.getFullYear();
          val = dd + '/' + mm + '/' + yyyy;
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
    sheet.getRange(1, 1, 1, 11).setValues([['id', 'email', 'password', 'name', 'role', 'department', 'managed_rooms', 'date_of_birth', 'gender', 'class_group', 'photo_url']]);
    // Tài khoản Ban Giám Hiệu (Quyền Admin) mặc định
    sheet.appendRow(['U001', 'bgh@school.edu.vn', '123456', 'Ban Giám Hiệu', 'vice_principal', 'BGH', '', '', '', '', '']);
    sheet.appendRow(['U002', 'equipment@school.edu.vn', '123456', 'Cán bộ Thiết bị', 'equipment', 'Thiết bị', '', '', '', '', '']);
  }
  
  // Sheet: books
  sheet = ss.getSheetByName('books');
  if (!sheet) {
    sheet = ss.insertSheet('books');
    sheet.getRange(1, 1, 1, 10).setValues([['id', 'title', 'author', 'isbn', 'category', 'publisher', 'year', 'quantity', 'location', 'created_date']]);
  }
  
  // Sheet: book_borrows
  sheet = ss.getSheetByName('book_borrows');
  if (!sheet) {
    sheet = ss.insertSheet('book_borrows');
    sheet.getRange(1, 1, 1, 11).setValues([['id', 'book_id', 'borrower', 'borrower_type', 'class', 'borrow_date', 'due_date', 'return_date', 'status', 'quantity', 'note']]);
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
  var deviceData = {
    id: id,
    name: data.name || '',
    subject: data.subject || '',
    room: data.room || '',
    status: data.status || 'Tốt',
    purchase_date: data.purchase_date || new Date().toISOString().split('T')[0],
    value: data.value || 0,
    qr_code: id,
    quantity: parseInt(data.quantity) || 1,
    created_by: data.created_by || '',
    model: data.model || '',
    supplier: data.supplier || '',
    description: data.description || '',
    damaged_qty: parseInt(data.damaged_qty) || 0
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
  // #4: Check for active borrows before deleting
  var history = sheetToObjects('borrow_history');
  var hasActive = history.some(function(r) {
    return String(r.device_id) === String(id) && (r.status === 'Đang mượn' || r.status === 'Trả thiếu');
  });
  if (hasActive) throw new Error('Không thể xóa thiết bị đang được mượn. Vui lòng thu hồi trước.');

  const found = findRowByIdInSheet('devices', id);
  if (!found) throw new Error('Không tìm thấy thiết bị');
  found.sheet.deleteRow(found.rowIndex);
  return { success: true };
}

// --- BORROW ---
function getBorrowHistory() {
  return sheetToObjects('borrow_history');
}

// Lấy số lượng đang được mượn của 1 thiết bị (trừ đã trả và đã mất)
function getBorrowedQty(deviceId) {
  var history = sheetToObjects('borrow_history');
  var total = 0;
  for (var i = 0; i < history.length; i++) {
    var r = history[i];
    if (String(r.device_id) === String(deviceId) && (r.status === 'Đang mượn' || r.status === 'Trả thiếu')) {
      var qty = parseInt(r.quantity) || 1;
      var returned = parseInt(r.returned_qty) || 0;
      var missing = parseInt(r.missing_qty) || 0;
      total += (qty - returned - missing);
    }
  }
  return total;
}

// Lấy tổng số lượng mất của 1 thiết bị (từ tất cả lịch sử)
function getTotalMissingQty(deviceId) {
  var history = sheetToObjects('borrow_history');
  var total = 0;
  for (var i = 0; i < history.length; i++) {
    var r = history[i];
    if (String(r.device_id) === String(deviceId)) {
      total += (parseInt(r.missing_qty) || 0);
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
  if (!data.teacher) throw new Error('Thiếu tên người mượn');
  
  var devices = getDevices();
  var device = devices.find(function(d) { return String(d.id) === String(data.device_id); });
  if (!device) throw new Error('Không tìm thấy thiết bị');
  if (device.status === 'Hỏng') throw new Error('Thiết bị đang bị hỏng, không thể mượn');
  if (device.status === 'Cần bảo trì') throw new Error('Thiết bị cần bảo trì, không thể mượn');
  if (device.status === 'Hỏng nhẹ') throw new Error('Thiết bị bị hỏng nhẹ, không thể mượn');
  if (device.status === 'Đã thanh lý') throw new Error('Thiết bị đã thanh lý, không thể mượn');
  
  var totalQty = parseInt(device.quantity) || 1;
  var borrowedQty = getBorrowedQty(data.device_id);
  var lostQty = getTotalMissingQty(data.device_id);
  var damagedQty = parseInt(device.damaged_qty) || 0;
  var availableQty = totalQty - borrowedQty - lostQty - damagedQty;
  var requestQty = parseInt(data.quantity) || 1;
  
  if ((!data.status || data.status !== 'Chờ duyệt') && requestQty > availableQty) {
    throw new Error('Không đủ số lượng. Còn ' + availableQty + '/' + totalQty + ' thiết bị');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var borrowSheet = ss.getSheetByName('borrow_history');
  var borrowId = 'BH' + new Date().getTime().toString().slice(-6);
  var now = data.borrow_date || new Date().toISOString();
  
  // Use header-based column mapping
  var headers = borrowSheet.getRange(1, 1, 1, borrowSheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  
  var borrowData = {
    id: borrowId,
    device_id: String(data.device_id),
    teacher: String(data.teacher),
    class: String(data.class),
    period: String(data.period || ''),
    borrow_date: now,
    return_date: '',
    status: data.status || 'Đang mượn',
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
  var returnQty = (data.returned_qty !== undefined && data.returned_qty !== null) ? parseInt(data.returned_qty) : remaining;
  var missingQty = parseInt(data.missing_qty) || 0;
  var returnDamagedQty2 = parseInt(data.damaged_qty) || 0;
  
  if (returnQty + returnDamagedQty2 + missingQty > remaining) {
    throw new Error('Tổng trả (' + (returnQty + returnDamagedQty2 + missingQty) + ') vượt quá SL còn (' + remaining + ')');
  }
  
  var newReturnedTotal = previousReturned + returnQty + returnDamagedQty2;
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
    
    // Update damaged_qty on device
    var returnDamagedQty = parseInt(data.damaged_qty) || 0;
    if (returnDamagedQty > 0) {
      try {
        var dFound = findRowByIdInSheet('devices', data.device_id);
        if (dFound) {
          var dh = dFound.headers;
          var dqCol = dh.indexOf('damaged_qty');
          if (dqCol !== -1) {
            var currentDamaged = parseInt(dFound.rowData[dqCol]) || 0;
            dFound.sheet.getRange(dFound.rowIndex, dqCol + 1).setValue(currentDamaged + returnDamagedQty);
          }
        }
      } catch (dErr) {
        Logger.log('Update damaged_qty error: ' + dErr.message);
      }
    }
    
    // Tự động tạo ghi chú bảo trì
    try {
      var maintenanceSheet = ss.getSheetByName('maintenance');
      if (maintenanceSheet) {
        var maintenanceId = 'MH' + new Date().getTime().toString().slice(-6);
        var statusMap = {
          'Hỏng nhẹ': 'Chưa sửa được',
          'Cần bảo trì': 'Chưa sửa được', 
          'Hỏng': 'Cần thay thế'
        };
        var mHeaders = maintenanceSheet.getRange(1, 1, 1, maintenanceSheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
        var mData = {
          id: maintenanceId,
          device_id: String(data.device_id),
          date: now.split('T')[0],
          content: 'Trả thiết bị - Tình trạng: ' + deviceStatus + (data.missing_note ? ' | ' + data.missing_note : ''),
          technician: String(data.teacher),
          result: statusMap[deviceStatus] || 'Chưa sửa được',
          room: currentDevice.room ? currentDevice.room + ' - ' + (currentDevice.subject || '') : ''
        };
        
        var mLastCol = mHeaders.length;
        var mAllHeaders = mHeaders.slice();
        for (var mk in mData) {
          if (mAllHeaders.indexOf(mk) === -1) {
            mAllHeaders.push(mk);
            maintenanceSheet.getRange(1, mLastCol + 1).setValue(mk);
            mLastCol++;
          }
        }
        var mNewRow = new Array(mAllHeaders.length).fill('');
        for (var mk2 in mData) {
          var mColIdx = mAllHeaders.indexOf(mk2);
          if (mColIdx !== -1) mNewRow[mColIdx] = mData[mk2];
        }
        maintenanceSheet.appendRow(mNewRow);
      }
    } catch (e) {
      // Không throw lỗi nếu không tạo được maintenance record
      Logger.log('Auto-maintenance error: ' + e.message);
    }
  } else if (stillBorrowed <= 0) {
    // Chỉ reset về Tốt khi tất cả đã trả VÀ trạng thái trả là Tốt
    updateDeviceStatus(data.device_id, 'Tốt');
  }
  
  // Lưu ý: KHÔNG giảm quantity khi mất — quantity là SL gốc ban đầu
  // Số mất được tính từ borrow_history (missing_qty)
  
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
  
  // #6: Check if room has devices before deleting
  var room = sheetToObjects('rooms').find(function(r) { return String(r.id) === String(id); });
  if (room) {
    var devices = sheetToObjects('devices');
    var hasDevices = devices.some(function(d) {
      return String(d.room) === String(room.name) && String(d.subject) === String(room.subject);
    });
    if (hasDevices) throw new Error('Không thể xóa phòng đang có thiết bị. Hãy chuyển thiết bị sang phòng khác trước.');
  }
  
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

// Auto-add missing columns to users sheet
function ensureUserColumns() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('users');
  if (!sheet || sheet.getLastRow() < 1) return;
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var requiredCols = ['date_of_birth', 'gender', 'class_group', 'photo_url'];
  var lastCol = headers.length;
  
  for (var i = 0; i < requiredCols.length; i++) {
    if (headers.indexOf(requiredCols[i]) === -1) {
      sheet.getRange(1, lastCol + 1).setValue(requiredCols[i]);
      lastCol++;
    }
  }
}

function getUsers() {
  ensureUserColumns();
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
  
  // Ensure headers exist
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 11).setValues([['user_id', 'name', 'email', 'password', 'role', 'department', 'managed_rooms', 'date_of_birth', 'gender', 'class_group', 'photo_url']]);
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  const id = data.id || data.user_id || 'U' + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMddHHmmss");
  
  const userData = { id: id, user_id: id, password: data.password || '123456' };
  for (var key in data) {
    userData[key.toLowerCase().trim()] = data[key];
  }
  userData['id'] = id;
  userData['user_id'] = id;
  if (!userData['password']) userData['password'] = '123456';
  
  // Auto-create missing columns
  var lastCol = headers.length;
  var allHeaders = headers.slice();
  for (var k in userData) {
    if (allHeaders.indexOf(k) === -1) {
      allHeaders.push(k);
      sheet.getRange(1, lastCol + 1).setValue(k);
      lastCol++;
    }
  }
  
  // Map data to correct column positions  
  var newRow = new Array(allHeaders.length).fill('');
  for (var k2 in userData) {
    var colIdx = allHeaders.indexOf(k2);
    if (colIdx !== -1) {
      newRow[colIdx] = userData[k2];
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

// ============ UPDATE MAINTENANCE RESULT ============
function updateMaintenanceResult(data) {
  // data: { id, result, damaged_qty?, repaired_qty? }
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('maintenance');
  if (!sheet) throw new Error('Không tìm thấy sheet maintenance');
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var resultCol = headers.indexOf('result');
  var deviceIdCol = headers.indexOf('device_id');
  
  if (idCol === -1 || resultCol === -1) throw new Error('Thiếu cột id hoặc result');
  
  var allData = sheet.getDataRange().getValues();
  var targetDeviceId = null;
  
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.getRange(i + 1, resultCol + 1).setValue(data.result);
      allData[i][resultCol] = data.result;
      if (deviceIdCol !== -1) {
        targetDeviceId = String(allData[i][deviceIdCol]).trim();
      }
      break;
    }
  }
  
  if (!targetDeviceId) return { success: true };
  
  var found = findRowByIdInSheet('devices', targetDeviceId);
  if (!found) return { success: true };
  
  var dHeaders = found.headers;
  var damagedCol = dHeaders.indexOf('damaged_qty');
  var statusCol = dHeaders.indexOf('status');
  var qtyCol = dHeaders.indexOf('quantity');
  var totalQty = parseInt(found.rowData[qtyCol]) || 1;
  var currentDamaged = parseInt(found.rowData[damagedCol]) || 0;
  
  var autoReset = false;
  
  if (data.result === 'Cần thay thế') {
    // Cần thay thế → set damaged_qty directly
    var newDamaged = parseInt(data.damaged_qty) || currentDamaged;
    if (damagedCol !== -1) {
      found.sheet.getRange(found.rowIndex, damagedCol + 1).setValue(newDamaged);
    }
    if (statusCol !== -1) {
      if (newDamaged >= totalQty) {
        found.sheet.getRange(found.rowIndex, statusCol + 1).setValue('Hỏng');
      } else if (newDamaged > 0) {
        found.sheet.getRange(found.rowIndex, statusCol + 1).setValue('Hỏng nhẹ');
      }
    }
  } else if (data.result === 'Đã sửa') {
    // Đã sửa → giảm damaged_qty theo repaired_qty
    var repairedQty = parseInt(data.repaired_qty) || currentDamaged; // mặc định sửa hết
    var newDamaged2 = Math.max(0, currentDamaged - repairedQty);
    if (damagedCol !== -1) {
      found.sheet.getRange(found.rowIndex, damagedCol + 1).setValue(newDamaged2);
    }
    if (statusCol !== -1) {
      if (newDamaged2 === 0) {
        found.sheet.getRange(found.rowIndex, statusCol + 1).setValue('Tốt');
        autoReset = true;
      } else if (newDamaged2 < totalQty) {
        found.sheet.getRange(found.rowIndex, statusCol + 1).setValue('Hỏng nhẹ');
      }
    }
  }
  
  return { success: true, device_id: targetDeviceId, auto_reset: autoReset };
}
// ============================================================
// TIỆN ÍCH SỬA SHEET — CHẠY 1 LẦN SAU KHI DEPLOY
// Mở Code.gs → Chọn hàm fixBorrowHistorySheet → Run
// ============================================================
function fixBorrowHistorySheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('borrow_history');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  // Tìm cột trống và xóa
  var emptyColIndexes = [];
  for (var c = headers.length - 1; c >= 0; c--) {
    if (String(headers[c]).trim() === '') {
      emptyColIndexes.push(c);
    }
  }
  
  // Xóa cột trống (từ phải sang trái để index không bị lệch)
  for (var i = 0; i < emptyColIndexes.length; i++) {
    sheet.deleteColumn(emptyColIndexes[i] + 1);
  }
  
  // Kiểm tra xem đã có đúng headers chưa, nếu chưa thì log
  var newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('Headers sau khi sửa: ' + JSON.stringify(newHeaders));
  Logger.log('Đã xóa ' + emptyColIndexes.length + ' cột trống');
  
  // Kiểm tra duplicate borrow_id column (nếu id và borrow_id đều có)
  var headerNames = newHeaders.map(function(h) { return String(h).toLowerCase().trim(); });
  var idIdx = headerNames.indexOf('id');
  var borrowIdIdx = headerNames.indexOf('borrow_id');
  
  if (idIdx !== -1 && borrowIdIdx !== -1 && idIdx !== borrowIdIdx) {
    // Cả hai đều có → xóa cột borrow_id thừa (giữ lại id)
    sheet.deleteColumn(borrowIdIdx + 1);
    Logger.log('Đã xóa cột borrow_id thừa (giữ lại cột id)');
  }
  
  return 'Đã sửa xong borrow_history sheet!';
}

// Sửa devices sheet — xóa cột trống
function fixDevicesSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('devices');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  for (var c = headers.length - 1; c >= 0; c--) {
    if (String(headers[c]).trim() === '') {
      sheet.deleteColumn(c + 1);
    }
  }
  
  var newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('Devices headers: ' + JSON.stringify(newHeaders));
  return 'Đã sửa xong devices sheet!';
}

// ============================================================
// BOOKS (THƯ VIỆN - QUẢN LÝ SÁCH)
// ============================================================

function getBooks() {
  return sheetToObjects('books');
}

function addBook(data) {
  if (!data.title) throw new Error('Thiếu tên sách');
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('books');
  if (!sheet) {
    sheet = ss.insertSheet('books');
    sheet.getRange(1, 1, 1, 10).setValues([['id', 'title', 'author', 'isbn', 'category', 'publisher', 'year', 'quantity', 'location', 'created_date']]);
  }
  
  var id = 'BK' + new Date().getTime().toString().slice(-6);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  
  var bookData = {
    id: id,
    title: data.title || '',
    author: data.author || '',
    isbn: data.isbn || '',
    category: data.category || 'Khác',
    publisher: data.publisher || '',
    year: data.year || '',
    quantity: parseInt(data.quantity) || 1,
    location: data.location || '',
    created_date: new Date().toISOString().split('T')[0]
  };
  
  // Auto-create missing columns
  var lastCol = headers.length;
  var allHeaders = headers.slice();
  for (var key in bookData) {
    if (allHeaders.indexOf(key) === -1) {
      allHeaders.push(key);
      sheet.getRange(1, lastCol + 1).setValue(key);
      lastCol++;
    }
  }
  
  var newRow = new Array(allHeaders.length).fill('');
  for (var key in bookData) {
    var colIdx = allHeaders.indexOf(key);
    if (colIdx !== -1) newRow[colIdx] = bookData[key];
  }
  
  sheet.appendRow(newRow);
  return { success: true, id: id };
}

function updateBook(id, updates) {
  var found = findRowByIdInSheet('books', id);
  if (!found) throw new Error('Không tìm thấy sách');
  
  var sheet = found.sheet, rowIndex = found.rowIndex, headers = found.headers, rowData = found.rowData;
  var newRow = rowData.slice();
  var changed = false;
  var lastCol = headers.length;
  
  for (var key in updates) {
    var colKey = key.toLowerCase();
    if (colKey === 'id') continue;
    var colIndex = headers.indexOf(colKey);
    if (colIndex === -1) {
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

function deleteBook(id) {
  var found = findRowByIdInSheet('books', id);
  if (!found) throw new Error('Không tìm thấy sách');
  found.sheet.deleteRow(found.rowIndex);
  return { success: true };
}

// Tính số sách đang được mượn (chưa trả) của 1 book_id
function getBookBorrowedQty(bookId) {
  var borrows = sheetToObjects('book_borrows');
  var total = 0;
  for (var i = 0; i < borrows.length; i++) {
    if (String(borrows[i].book_id) === String(bookId) && (borrows[i].status === 'Đang mượn' || borrows[i].status === 'Trả thiếu')) {
      total += (parseInt(borrows[i].quantity) || 1) - (parseInt(borrows[i].returned_qty) || 0);
    }
  }
  return total;
}

function getBookLostQty(bookId) {
  var borrows = sheetToObjects('book_borrows');
  var total = 0;
  for (var i = 0; i < borrows.length; i++) {
    if (String(borrows[i].book_id) === String(bookId)) {
      total += (parseInt(borrows[i].lost_qty) || 0);
    }
  }
  return total;
}

// Tính số sách đang mượn của 1 người
function getBorrowerActiveCount(borrower) {
  var borrows = sheetToObjects('book_borrows');
  var count = 0;
  for (var i = 0; i < borrows.length; i++) {
    if (String(borrows[i].borrower) === String(borrower) && borrows[i].status === 'Đang mượn') {
      count += (parseInt(borrows[i].quantity) || 1);
    }
  }
  return count;
}

function borrowBook(data) {
  if (!data.book_id) throw new Error('Thiếu mã sách');
  if (!data.borrower) throw new Error('Thiếu tên người mượn');
  
  var books = getBooks();
  var book = books.find(function(b) { return String(b.id) === String(data.book_id); });
  if (!book) throw new Error('Không tìm thấy sách');
  
  var totalQty = parseInt(book.quantity) || 1;
  var borrowedQty = getBookBorrowedQty(data.book_id);
  var lostQty = getBookLostQty(data.book_id);
  var requestQty = parseInt(data.quantity) || 1;
  var availableQty = totalQty - borrowedQty - lostQty;
  
  if ((!data.status || data.status !== 'Chờ duyệt') && requestQty > availableQty) {
    throw new Error('Không đủ sách. Còn ' + availableQty + '/' + totalQty + ' cuốn');
  }
  
  // Không giới hạn số lượng mượn — tùy biến theo người dùng
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('book_borrows');
  if (!sheet) {
    sheet = ss.insertSheet('book_borrows');
    sheet.getRange(1, 1, 1, 11).setValues([['id', 'book_id', 'borrower', 'borrower_type', 'class', 'borrow_date', 'due_date', 'return_date', 'status', 'quantity', 'note']]);
  }
  
  var borrowId = 'BB' + new Date().getTime().toString().slice(-6);
  var now = new Date();
  var borrowerType = data.borrower_type || 'GV';
  var dueDays = borrowerType === 'GV' ? 30 : 14;
  
  // Use custom dates if provided, otherwise auto-calculate
  var borrowDateVal = data.borrow_date ? new Date(data.borrow_date) : now;
  var dueDateVal = data.due_date ? new Date(data.due_date) : new Date(borrowDateVal.getTime() + dueDays * 24 * 60 * 60 * 1000);
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  
  var borrowData = {
    id: borrowId,
    book_id: String(data.book_id),
    borrower: String(data.borrower),
    borrower_type: borrowerType,
    class: String(data.class || ''),
    borrow_date: borrowDateVal.toISOString(),
    due_date: dueDateVal.toISOString(),
    return_date: '',
    status: data.status || 'Đang mượn',
    quantity: requestQty,
    note: String(data.note || '')
  };
  
  // Auto-create missing columns
  var lastCol = headers.length;
  var allHeaders = headers.slice();
  for (var key in borrowData) {
    if (allHeaders.indexOf(key) === -1) {
      allHeaders.push(key);
      sheet.getRange(1, lastCol + 1).setValue(key);
      lastCol++;
    }
  }
  
  var newRow = new Array(allHeaders.length).fill('');
  for (var key in borrowData) {
    var colIdx = allHeaders.indexOf(key);
    if (colIdx !== -1) newRow[colIdx] = borrowData[key];
  }
  
  sheet.appendRow(newRow);
  return { success: true, id: borrowId, available: availableQty - requestQty };
}

function returnBookFn(data) {
  if (!data.borrow_id) throw new Error('Thiếu mã lượt mượn');
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('book_borrows');
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  
  var idCol = headers.indexOf('id');
  var statusCol = headers.indexOf('status');
  var returnDateCol = headers.indexOf('return_date');
  var noteCol = headers.indexOf('note');
  var quantityCol = headers.indexOf('quantity');
  
  var foundRow = -1;
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.borrow_id)) {
      foundRow = i;
      break;
    }
  }
  
  if (foundRow === -1) throw new Error('Không tìm thấy lượt mượn sách');
  if (String(allData[foundRow][statusCol]) === 'Đã trả') {
    throw new Error('Sách đã được trả');
  }
  
  var borrowedQty = parseInt(allData[foundRow][quantityCol]) || 1;
  
  // Support partial returns — check previous returned/lost
  var returnedQtyCol = headers.indexOf('returned_qty');
  var lostQtyCol = headers.indexOf('lost_qty');
  var previousReturned = (returnedQtyCol !== -1) ? (parseInt(allData[foundRow][returnedQtyCol]) || 0) : 0;
  var previousLost = (lostQtyCol !== -1) ? (parseInt(allData[foundRow][lostQtyCol]) || 0) : 0;
  var remaining = borrowedQty - previousReturned - previousLost;
  
  var returnedQty = (data.returned_qty !== undefined && data.returned_qty !== null) ? parseInt(data.returned_qty) : remaining;
  var damagedQty = parseInt(data.damaged_qty) || 0;
  var lostQty = parseInt(data.lost_qty) || 0;
  var totalThisReturn = returnedQty + damagedQty + lostQty;
  
  if (totalThisReturn > remaining) {
    throw new Error('Tổng trả (' + totalThisReturn + ') vượt quá SL còn (' + remaining + ')');
  }
  
  // returned_qty stores good + damaged (physically returned), same as device
  var newReturnedTotal = previousReturned + returnedQty + damagedQty;
  var newLostTotal = previousLost + lostQty;
  
  var now = new Date().toISOString();
  var newStatus = (newReturnedTotal + newLostTotal >= borrowedQty) ? 'Đã trả' :
                  (newReturnedTotal + newLostTotal > 0) ? 'Trả thiếu' : 'Đang mượn';
  
  sheet.getRange(foundRow + 1, statusCol + 1).setValue(newStatus);
  if (newStatus === 'Đã trả') {
    sheet.getRange(foundRow + 1, returnDateCol + 1).setValue(now);
  }
  
  if (data.note && noteCol !== -1) {
    sheet.getRange(foundRow + 1, noteCol + 1).setValue(data.note);
  }
  
  // Write returned_qty, damaged_qty, lost_qty, condition_note
  var extraCols = ['returned_qty', 'damaged_qty', 'lost_qty', 'condition_note'];
  var extraVals = [newReturnedTotal, damagedQty, newLostTotal, String(data.condition_note || '')];
  var lastCol = headers.length;
  
  for (var c = 0; c < extraCols.length; c++) {
    var colIdx = headers.indexOf(extraCols[c]);
    if (colIdx === -1) {
      // Auto-create column
      headers.push(extraCols[c]);
      sheet.getRange(1, lastCol + 1).setValue(extraCols[c]);
      colIdx = lastCol;
      lastCol++;
    }
    sheet.getRange(foundRow + 1, colIdx + 1).setValue(extraVals[c]);
  }
  
  // Reduce book quantity for lost/damaged
  if (lostQty > 0 || damagedQty > 0) {
    var bookIdCol = headers.indexOf('book_id');
    var bookId = String(allData[foundRow][bookIdCol]);
    var bookSheet = ss.getSheetByName('books');
    if (bookSheet) {
      var bookData = bookSheet.getDataRange().getValues();
      var bookHeaders = bookData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      var bkIdCol = bookHeaders.indexOf('id');
      var bkQtyCol = bookHeaders.indexOf('quantity');
      for (var r = 1; r < bookData.length; r++) {
        if (String(bookData[r][bkIdCol]) === bookId) {
          var currentQty = parseInt(bookData[r][bkQtyCol]) || 1;
          var newQty = Math.max(0, currentQty - lostQty);
          bookSheet.getRange(r + 1, bkQtyCol + 1).setValue(newQty);
          break;
        }
      }
    }
  }
  
  return { success: true, status: newStatus };
}

function getBookBorrowHistory() {
  return sheetToObjects('book_borrows');
}

function getBookStats() {
  var books = getBooks();
  var borrows = sheetToObjects('book_borrows');
  var now = new Date();
  
  var totalBooks = books.length;
  var totalQuantity = 0;
  for (var i = 0; i < books.length; i++) {
    totalQuantity += (parseInt(books[i].quantity) || 1);
  }
  
  var activeBorrows = 0;
  var overdue = 0;
  for (var j = 0; j < borrows.length; j++) {
    if (borrows[j].status === 'Đang mượn') {
      activeBorrows += (parseInt(borrows[j].quantity) || 1);
      if (borrows[j].due_date) {
        try {
          var dueDate = new Date(borrows[j].due_date);
          if (now > dueDate) overdue++;
        } catch(e) {}
      }
    }
  }
  
  // Top 5 sách mượn nhiều nhất
  var bookBorrowCount = {};
  for (var k = 0; k < borrows.length; k++) {
    var bid = borrows[k].book_id;
    if (!bookBorrowCount[bid]) bookBorrowCount[bid] = 0;
    bookBorrowCount[bid] += (parseInt(borrows[k].quantity) || 1);
  }
  
  var topBooks = Object.keys(bookBorrowCount).map(function(id) {
    var b = books.find(function(bk) { return String(bk.id) === String(id); });
    return { id: id, title: b ? b.title : id, count: bookBorrowCount[id] };
  });
  topBooks.sort(function(a, b) { return b.count - a.count; });
  topBooks = topBooks.slice(0, 10);
  
  // Thống kê theo thể loại
  var categoryStats = {};
  for (var m = 0; m < books.length; m++) {
    var cat = books[m].category || 'Khác';
    if (!categoryStats[cat]) categoryStats[cat] = 0;
    categoryStats[cat] += (parseInt(books[m].quantity) || 1);
  }
  
  return {
    totalBooks: totalBooks,
    totalQuantity: totalQuantity,
    activeBorrows: activeBorrows,
    overdue: overdue,
    available: totalQuantity - activeBorrows,
    topBooks: topBooks,
    categoryStats: categoryStats
  };
}

function borrowMultipleBooks(data) {
  if (!data.borrower) throw new Error('Thiếu tên người mượn');
  if (!data.items || !data.items.length) throw new Error('Chưa chọn sách');
  
  var books = getBooks();
  var borrowerType = data.borrower_type || 'GV';
  var dueDays = borrowerType === 'GV' ? 30 : 14;
  var now = new Date();
  var dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);
  
  // Check borrower limit
  var activeCount = getBorrowerActiveCount(data.borrower);
  var totalRequest = 0;
  for (var t = 0; t < data.items.length; t++) {
    totalRequest += (parseInt(data.items[t].quantity) || 1);
  }
  if (activeCount + totalRequest > 10) {
    throw new Error('Vượt quá giới hạn mượn. Đang mượn: ' + activeCount + ', yêu cầu thêm: ' + totalRequest + ', tối đa: 10');
  }
  
  // Validate stock for each book
  for (var v = 0; v < data.items.length; v++) {
    var item = data.items[v];
    var book = books.find(function(b) { return String(b.id) === String(item.book_id); });
    if (!book) throw new Error('Không tìm thấy sách: ' + item.book_id);
    var avail = (parseInt(book.quantity) || 1) - getBookBorrowedQty(item.book_id);
    var reqQty = parseInt(item.quantity) || 1;
    if (reqQty > avail) {
      throw new Error('Sách "' + book.title + '" chỉ còn ' + avail + ' cuốn');
    }
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('book_borrows');
  if (!sheet) {
    sheet = ss.insertSheet('book_borrows');
    sheet.getRange(1, 1, 1, 15).setValues([['id', 'book_id', 'borrower', 'borrower_type', 'class', 'borrow_date', 'due_date', 'return_date', 'status', 'quantity', 'note', 'returned_qty', 'damaged_qty', 'lost_qty', 'condition_note']]);
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  
  var ids = [];
  for (var i = 0; i < data.items.length; i++) {
    var itm = data.items[i];
    var borrowId = 'BB' + new Date().getTime().toString().slice(-6) + i;
    ids.push(borrowId);
    
    var borrowData = {
      id: borrowId,
      book_id: String(itm.book_id),
      borrower: String(data.borrower),
      borrower_type: borrowerType,
      class: String(data.class || ''),
      borrow_date: now.toISOString(),
      due_date: dueDate.toISOString(),
      return_date: '',
      status: data.status || 'Đang mượn',
      quantity: parseInt(itm.quantity) || 1,
      note: String(data.note || ''),
      returned_qty: '',
      damaged_qty: '',
      lost_qty: '',
      condition_note: ''
    };
    
    var newRow = new Array(headers.length).fill('');
    for (var key in borrowData) {
      var colIdx = headers.indexOf(key);
      if (colIdx !== -1) newRow[colIdx] = borrowData[key];
    }
    sheet.appendRow(newRow);
  }
  
  return { success: true, ids: ids, count: data.items.length };
}

// --- UPLOAD PHOTO TO GOOGLE DRIVE ---
// Tạo folder shared 'AnhThe_MuonTra', upload ảnh base64, trả về URL public
function uploadPhoto(data) {
  if (!data.base64 || !data.fileName) {
    throw new Error('Thiếu dữ liệu ảnh hoặc tên file');
  }
  
  // Kiểm tra kích thước (base64 ~33% lớn hơn binary, 1MB binary ≈ 1.37MB base64)
  var base64Data = data.base64;
  // Tách phần header nếu là data URL (data:image/png;base64,xxxxx)
  if (base64Data.indexOf(',') !== -1) {
    base64Data = base64Data.split(',')[1];
  }
  
  var sizeBytes = base64Data.length * 3 / 4; // ước lượng kích thước binary
  var maxSize = 1 * 1024 * 1024; // 1MB
  if (sizeBytes > maxSize) {
    throw new Error('Ảnh quá lớn! Tối đa 1MB. Ảnh hiện tại: ' + (sizeBytes / 1024 / 1024).toFixed(2) + 'MB');
  }
  
  // Tìm hoặc tạo folder
  var folderName = 'AnhThe_MuonTra';
  var folders = DriveApp.getFoldersByName(folderName);
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
    // Share folder cho anyone có link xem được
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  
  // Decode base64 và tạo blob
  var decoded = Utilities.base64Decode(base64Data);
  var mimeType = data.mimeType || 'image/jpeg';
  var blob = Utilities.newBlob(decoded, mimeType, data.fileName);
  
  // Upload vào folder
  var file = folder.createFile(blob);
  
  // Set public sharing cho file
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  var fileId = file.getId();
  // URL dạng lh3 để hiển thị trực tiếp trong web (không bị CORS)
  var url = 'https://lh3.googleusercontent.com/d/' + fileId + '=w400';
  
  return { success: true, url: url, fileId: fileId };
}

// --- APPROVE/REJECT BOOK BORROW ---
function approveBookBorrow(data) {
  if (!data.borrow_id) throw new Error('Thiếu mã mượn');
  var found = findRowByIdInSheet('book_borrows', data.borrow_id);
  if (!found) throw new Error('Không tìm thấy phiếu mượn');
  
  var headers = found.headers;
  var rowData = found.rowData;
  var statusCol = headers.indexOf('status');
  
  if (String(rowData[statusCol]) !== 'Chờ duyệt') {
    throw new Error('Phiếu này không ở trạng thái chờ duyệt');
  }
  
  // Update status to Đang mượn
  found.sheet.getRange(found.rowIndex, statusCol + 1).setValue('Đang mượn');
  
  return { success: true, message: 'Đã duyệt phiếu mượn' };
}

function rejectBookBorrow(data) {
  if (!data.borrow_id) throw new Error('Thiếu mã mượn');
  var found = findRowByIdInSheet('book_borrows', data.borrow_id);
  if (!found) throw new Error('Không tìm thấy phiếu mượn');
  
  var headers = found.headers;
  var rowData = found.rowData;
  var statusCol = headers.indexOf('status');
  
  if (String(rowData[statusCol]) !== 'Chờ duyệt') {
    throw new Error('Phiếu này không ở trạng thái chờ duyệt');
  }
  
  // Update status to Từ chối
  found.sheet.getRange(found.rowIndex, statusCol + 1).setValue('Từ chối');
  
  return { success: true, message: 'Đã từ chối phiếu mượn' };
}

// Chạy hàm này 1 lần để cấp quyền Drive (chọn testDrivePermission → ▶️ Chạy)
function testDrivePermission() {
  // Tạo folder luôn để cấp quyền GHI (không chỉ đọc)
  var folderName = 'AnhThe_MuonTra';
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    Logger.log('OK - Folder ' + folderName + ' đã tồn tại');
  } else {
    var folder = DriveApp.createFolder(folderName);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    Logger.log('OK - Đã tạo folder ' + folderName);
  }
  Logger.log('Quyền Drive (đọc + ghi) đã được cấp thành công!');
}


function approveDeviceBorrow(data) {
  // data: { id } — borrow record ID
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('borrow_history');
  if (!sheet) throw new Error('Sheet not found');
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var statusCol = headers.indexOf('status');
  if (idCol === -1 || statusCol === -1) throw new Error('Missing columns');
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      if (String(allData[i][statusCol]).trim() !== 'Chờ duyệt') {
        throw new Error('Lượt mượn này không ở trạng thái chờ duyệt');
      }
      sheet.getRange(i + 1, statusCol + 1).setValue('Đang mượn');
      return { success: true };
    }
  }
  throw new Error('Không tìm thấy lượt mượn');
}

function rejectDeviceBorrow(data) {
  // data: { id } — borrow record ID
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('borrow_history');
  if (!sheet) throw new Error('Sheet not found');
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var statusCol = headers.indexOf('status');
  if (idCol === -1 || statusCol === -1) throw new Error('Missing columns');
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      if (String(allData[i][statusCol]).trim() !== 'Chờ duyệt') {
        throw new Error('Lượt mượn này không ở trạng thái chờ duyệt');
      }
      sheet.getRange(i + 1, statusCol + 1).setValue('Từ chối');
      return { success: true };
    }
  }
  throw new Error('Không tìm thấy lượt mượn');
}
