//go:build windows

package main

import (
	"os"
	"path/filepath"
	"syscall"
	"unicode/utf16"
	"unsafe"
)

var (
	comdlg32           = syscall.NewLazyDLL("comdlg32.dll")
	user32             = syscall.NewLazyDLL("user32.dll")
	procGetOpenFile    = comdlg32.NewProc("GetOpenFileNameW")
	procGetSaveFile    = comdlg32.NewProc("GetSaveFileNameW")
	procMessageBox     = user32.NewProc("MessageBoxW")
	procSetWindowTxt   = user32.NewProc("SetWindowTextW")
	procSetWindowLong  = user32.NewProc("SetWindowLongPtrW")
	procCallWindowProc = user32.NewProc("CallWindowProcW")
	procPostMessage    = user32.NewProc("PostMessageW")
)

const (
	ofnOverwritePrompt = 0x2
	ofnNoChangeDir     = 0x8
	ofnPathMustExist   = 0x800
	ofnFileMustExist   = 0x1000
	ofnExplorer        = 0x80000

	wmClose       = 0x0010
	mbYesNoCancel = 0x3
	mbIconWarning = 0x30
	mbIconError   = 0x10
	idYes         = 6
	idNo          = 7
	gwlpWndProc   = ^uintptr(3) // -4
)

// mainHwnd is the application window, owner of all dialogs.
var mainHwnd uintptr

type openFileName struct {
	lStructSize       uint32
	hwndOwner         uintptr
	hInstance         uintptr
	lpstrFilter       *uint16
	lpstrCustomFilter *uint16
	nMaxCustFilter    uint32
	nFilterIndex      uint32
	lpstrFile         *uint16
	nMaxFile          uint32
	lpstrFileTitle    *uint16
	nMaxFileTitle     uint32
	lpstrInitialDir   *uint16
	lpstrTitle        *uint16
	flags             uint32
	nFileOffset       uint16
	nFileExtension    uint16
	lpstrDefExt       *uint16
	lCustData         uintptr
	lpfnHook          uintptr
	lpTemplateName    *uint16
	pvReserved        uintptr
	dwReserved        uint32
	flagsEx           uint32
}

func utf16z(s string) []uint16 { return append(utf16.Encode([]rune(s)), 0) }

func filterSpec(desc, ext string) string {
	return desc + " (*." + ext + ")\x00*." + ext + "\x00All files (*.*)\x00*.*\x00\x00"
}

// fileDialog shows the standard Windows open or save dialog. It returns false if cancelled.
func fileDialog(save bool, initial, filter, defExt string) (string, bool) {
	f := utf16.Encode([]rune(filter))
	buf := make([]uint16, 4096)
	copy(buf, utf16.Encode([]rune(initial)))
	ext := utf16z(defExt)
	ofn := openFileName{hwndOwner: mainHwnd, lpstrFilter: &f[0], nFilterIndex: 1, lpstrFile: &buf[0], nMaxFile: uint32(len(buf)), lpstrDefExt: &ext[0]}
	ofn.lStructSize = uint32(unsafe.Sizeof(ofn))
	var r uintptr
	if save {
		ofn.flags = ofnOverwritePrompt | ofnPathMustExist | ofnExplorer | ofnNoChangeDir
		r, _, _ = procGetSaveFile.Call(uintptr(unsafe.Pointer(&ofn)))
	} else {
		ofn.flags = ofnFileMustExist | ofnPathMustExist | ofnExplorer | ofnNoChangeDir
		r, _, _ = procGetOpenFile.Call(uintptr(unsafe.Pointer(&ofn)))
	}
	if r == 0 {
		return "", false
	}
	return syscall.UTF16ToString(buf), true
}

func messageBox(owner uintptr, title, text string, flags uintptr) int {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(text)
	r, _, _ := procMessageBox.Call(owner, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), flags)
	return int(r)
}

func setWindowTitle(t string) {
	p, _ := syscall.UTF16PtrFromString(t)
	procSetWindowTxt.Call(mainHwnd, uintptr(unsafe.Pointer(p)))
}

// ---------- close handling: ask before discarding unsaved work ----------

var (
	origWndProc uintptr
	closeOK     bool
	unsaved     bool
	onCloseSave func() // asks the interface to save, then quit
	onDiscard   func()
)

func hookClose() {
	cb := syscall.NewCallback(func(h, msg, wp, lp uintptr) uintptr {
		if msg == wmClose && unsaved && !closeOK {
			switch messageBox(h, "OpenSchem", "Save changes to the project before closing?", mbYesNoCancel|mbIconWarning) {
			case idYes:
				if onCloseSave != nil {
					onCloseSave()
				}
				return 0
			case idNo:
				if onDiscard != nil {
					onDiscard()
				}
				closeOK = true
			default:
				return 0
			}
		}
		r, _, _ := procCallWindowProc.Call(origWndProc, h, msg, wp, lp)
		return r
	})
	origWndProc, _, _ = procSetWindowLong.Call(mainHwnd, gwlpWndProc, cb)
}

func quitApp() {
	closeOK = true
	procPostMessage.Call(mainHwnd, wmClose, 0, 0)
}

// ---------- files and the portable data folder ----------

func writable(d string) bool {
	if os.MkdirAll(d, 0o755) != nil {
		return false
	}
	t := filepath.Join(d, ".write-test")
	if os.WriteFile(t, []byte("ok"), 0o644) != nil {
		return false
	}
	os.Remove(t)
	return true
}

// dataDir keeps everything next to the exe ("OpenSchem Data") so the program stays portable.
// If that folder is not writable (read-only media, Program Files), it falls back to %LOCALAPPDATA%.
func dataDir() string {
	if exe, err := os.Executable(); err == nil {
		d := filepath.Join(filepath.Dir(exe), "OpenSchem Data")
		if writable(d) {
			return d
		}
	}
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base = os.TempDir()
	}
	d := filepath.Join(base, "OpenSchem")
	os.MkdirAll(d, 0o755)
	return d
}

// writeAtomic writes via a temp file and keeps the previous version as .bak.
func writeAtomic(path string, data []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	if _, err := os.Stat(path); err == nil {
		os.Remove(path + ".bak")
		os.Rename(path, path+".bak")
	}
	return os.Rename(tmp, path)
}
