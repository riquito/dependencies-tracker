// Copied from https://raw.githubusercontent.com/ankitrohatgi/tarballjs/29b6e87/tarball.js
// I copied it because it was not updated in a couple years and it was risky
// to have a dependency with few eyes on the updates.
// There is a major edit: is refactored to typescript

// MIT License

// Copyright (c) 2017 Ankit Rohatgi

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

export type FileInfo = {
    "name": string,
    "type": string,
    "size": number,
    "header_offset": number
}

export class TarReader {
    fileInfo: FileInfo[] = [];
    buffer: ArrayBuffer;

    constructor() {
        this.fileInfo = [];
        this.buffer = new ArrayBuffer(0)
    }

    readFile(file: Blob): Promise<FileInfo[]> {
        return new Promise((resolve) => {
            let reader = new FileReader();
            reader.onload = (event) => {
                this.buffer = (event.target!.result! as ArrayBuffer);
                this.fileInfo = [];
                this._readFileInfo();
                resolve(this.fileInfo);
            };
            reader.readAsArrayBuffer(file);
        });
    }

    readArrayBuffer(arrayBuffer: ArrayBuffer) {
        this.buffer = arrayBuffer;
        this.fileInfo = [];
        this._readFileInfo();
        return this.fileInfo;
    }

    _readFileInfo() {
        this.fileInfo = [];
        let offset = 0;
        let file_size = 0;
        let file_name = "";
        let file_type = null;
        while (offset < this.buffer.byteLength - 512) {
            file_name = this._readFileName(offset); // file name
            if (file_name.length == 0) {
                break;
            }
            file_type = this._readFileType(offset);
            file_size = this._readFileSize(offset);

            this.fileInfo.push({
                "name": file_name,
                "type": file_type,
                "size": file_size,
                "header_offset": offset
            });

            offset += (512 + 512 * Math.trunc(file_size / 512));
            if (file_size % 512) {
                offset += 512;
            }
        }
    }

    getFileInfo() {
        return this.fileInfo;
    }

    _readString(str_offset: number, size: number) {
        let strView = new Uint8Array(this.buffer, str_offset, size);
        let i = strView.indexOf(0);
        let td = new TextDecoder();
        return td.decode(strView.slice(0, i));
    }

    _readFileName(header_offset: number) {
        let name = this._readString(header_offset, 100);
        return name;
    }

    _readFileType(header_offset: number) {
        // offset: 156
        let typeView = new Uint8Array(this.buffer, header_offset + 156, 1);
        let typeStr = String.fromCharCode(typeView[0]);
        if (typeStr == "0") {
            return "file";
        } else if (typeStr == "5") {
            return "directory";
        } else {
            return typeStr;
        }
    }

    _readFileSize(header_offset: number) {
        // offset: 124
        let szView = new Uint8Array(this.buffer, header_offset + 124, 12);
        let szStr = "";
        for (let i = 0; i < 11; i++) {
            szStr += String.fromCharCode(szView[i]);
        }
        return parseInt(szStr, 8);
    }

    _readFileBlob(file_offset: number, size: number, mimetype: string) {
        let view = new Uint8Array(this.buffer, file_offset, size);
        let blob = new Blob([view], { "type": mimetype });
        return blob;
    }

    _readFileBinary(file_offset: number, size: number) {
        let view = new Uint8Array(this.buffer, file_offset, size);
        return view;
    }

    _readTextFile(file_offset: number, size: number) {
        let view = new Uint8Array(this.buffer, file_offset, size);
        let td = new TextDecoder();
        return td.decode(view);
    }

    getTextFile(file_name: string) {
        let info = this.fileInfo.find(info => info.name == file_name);
        if (info) {
            return this._readTextFile(info.header_offset + 512, info.size);
        }
    }

    getFileBlob(file_name: string, mimetype: string) {
        let info = this.fileInfo.find(info => info.name == file_name);
        if (info) {
            return this._readFileBlob(info.header_offset + 512, info.size, mimetype);
        }
    }

    getFileBinary(file_name: string) {
        let info = this.fileInfo.find(info => info.name == file_name);
        if (info) {
            return this._readFileBinary(info.header_offset + 512, info.size);
        }
    }
};

export type FileType = 'file' | 'directory'

export type FileData = {
    "name": string,
    "array": Uint8Array,
    "file": Blob,
    "type": FileType,
    "size": number,
    "dataType": string,
    "opts": any
}

export class TarWriter {
    buffer: ArrayBuffer;
    fileData: FileData[] = []

    constructor() {
        this.buffer = new ArrayBuffer(0);
        this.fileData = [];
    }

    addTextFile(name: string, text: string, opts: any) {
        let te = new TextEncoder();
        let arr = te.encode(text);
        this.fileData.push({
            name: name,
            array: arr,
            type: "file",
            size: arr.length,
            dataType: "array",
            file: new Blob(),
            opts: opts,
        });
    }

    addFileArrayBuffer(name: string, arrayBuffer: ArrayBuffer, opts: any) {
        let arr = new Uint8Array(arrayBuffer);
        this.fileData.push({
            name: name,
            array: arr,
            type: "file",
            size: arr.length,
            dataType: "array",
            file: new Blob(),
            opts: opts,
        });
    }

    addFile(name: string, file: Blob, opts: any) {
        this.fileData.push({
            name: name,
            file: file,
            size: file.size,
            type: "file",
            dataType: "file",
            opts: opts,
            array: new Uint8Array(),
        });
    }

    addFolder(name: string, opts: any) {
        this.fileData.push({
            name: name,
            type: "directory",
            size: 0,
            dataType: "none",
            opts: opts,
            array: new Uint8Array(),
            file: new Blob(),
        });
    }

    _createBuffer() {
        let tarDataSize = 0;
        for (let i = 0; i < this.fileData.length; i++) {
            let size = this.fileData[i].size;
            tarDataSize += 512 + 512 * Math.trunc(size / 512);
            if (size % 512) {
                tarDataSize += 512;
            }
        }
        let bufSize = 10240 * Math.trunc(tarDataSize / 10240);
        if (tarDataSize % 10240) {
            bufSize += 10240;
        }
        this.buffer = new ArrayBuffer(bufSize);
    }

    async download(filename: string) {
        let blob = await this.writeBlob();
        let $downloadElem = document.createElement('a');
        $downloadElem.href = URL.createObjectURL(blob);
        $downloadElem.download = filename;
        $downloadElem.style.display = "none";
        document.body.appendChild($downloadElem);
        $downloadElem.click();
        document.body.removeChild($downloadElem);
    }

    async writeBlob(onUpdate?: (progress: number) => void) {
        return new Blob([await this.write(onUpdate)], { "type": "application/x-tar" });
    }

    write(onUpdate?: (progress: number) => void): Promise<Uint8Array> {
        return new Promise((resolve) => {
            this._createBuffer();
            let offset = 0;
            let filesAdded = 0;
            let onFileDataAdded = () => {
                filesAdded++;
                if (onUpdate) {
                    onUpdate(filesAdded / this.fileData.length * 100);
                }
                if (filesAdded === this.fileData.length) {
                    let arr = new Uint8Array(this.buffer);
                    resolve(arr);
                }
            };
            for (let fileIdx = 0; fileIdx < this.fileData.length; fileIdx++) {
                let fdata = this.fileData[fileIdx];
                // write header
                this._writeFileName(fdata.name, offset);
                this._writeFileType(fdata.type, offset);
                this._writeFileSize(fdata.size, offset);
                this._fillHeader(offset, fdata.opts, fdata.type);
                this._writeChecksum(offset);

                // write file data
                let destArray = new Uint8Array(this.buffer, offset + 512, fdata.size);
                if (fdata.dataType === "array") {
                    for (let byteIdx = 0; byteIdx < fdata.size; byteIdx++) {
                        destArray[byteIdx] = fdata.array[byteIdx];
                    }
                    onFileDataAdded();
                } else if (fdata.dataType === "file") {
                    let reader = new FileReader();

                    reader.onload = (function (outArray) {
                        let dArray = outArray;
                        return function (event) {
                            let sbuf = (event.target!.result! as ArrayBuffer);
                            let sarr = new Uint8Array(sbuf);
                            for (let bIdx = 0; bIdx < sarr.length; bIdx++) {
                                dArray[bIdx] = sarr[bIdx];
                            }
                            onFileDataAdded();
                        };
                    })(destArray);
                    reader.readAsArrayBuffer(fdata.file);
                } else if (fdata.type === "directory") {
                    onFileDataAdded();
                }

                offset += (512 + 512 * Math.trunc(fdata.size / 512));
                if (fdata.size % 512) {
                    offset += 512;
                }
            }
        });
    }

    _writeString(str: string, offset: number, size: number) {
        let strView = new Uint8Array(this.buffer, offset, size);
        let te = new TextEncoder();
        if (te.encodeInto) {
            // let the browser write directly into the buffer
            let written = te.encodeInto(str, strView).written;
            for (let i = written; i < size; i++) {
                strView[i] = 0;
            }
        } else {
            // browser can't write directly into the buffer, do it manually
            let arr = te.encode(str);
            for (let i = 0; i < size; i++) {
                strView[i] = i < arr.length ? arr[i] : 0;
            }
        }
    }

    _writeFileName(name: string, header_offset: number) {
        // offset: 0
        this._writeString(name, header_offset, 100);
    }

    _writeFileType(typeStr: FileType, header_offset: number) {
        // offset: 156
        let typeChar = "0";
        if (typeStr === "file") {
            typeChar = "0";
        } else if (typeStr === "directory") {
            typeChar = "5";
        }
        let typeView = new Uint8Array(this.buffer, header_offset + 156, 1);
        typeView[0] = typeChar.charCodeAt(0);
    }

    _writeFileSize(size: number, header_offset: number) {
        // offset: 124
        let sz = size.toString(8);
        sz = this._leftPad(sz, 11);
        this._writeString(sz, header_offset + 124, 12);
    }

    _leftPad(number: number | string, targetLength: number) {
        let output = number + '';
        while (output.length < targetLength) {
            output = '0' + output;
        }
        return output;
    }

    _writeFileMode(mode: number, header_offset: number) {
        // offset: 100
        this._writeString(this._leftPad(mode, 7), header_offset + 100, 8);
    }

    _writeFileUid(uid: number, header_offset: number) {
        // offset: 108
        this._writeString(this._leftPad(uid, 7), header_offset + 108, 8);
    }

    _writeFileGid(gid: number, header_offset: number) {
        // offset: 116
        this._writeString(this._leftPad(gid, 7), header_offset + 116, 8);
    }

    _writeFileMtime(mtime: number, header_offset: number) {
        // offset: 136
        this._writeString(this._leftPad(mtime, 11), header_offset + 136, 12);
    }

    _writeFileUser(user: string, header_offset: number) {
        // offset: 265
        this._writeString(user, header_offset + 265, 32);
    }

    _writeFileGroup(group: string, header_offset: number) {
        // offset: 297
        this._writeString(group, header_offset + 297, 32);
    }

    _writeChecksum(header_offset: number) {
        // offset: 148
        this._writeString("        ", header_offset + 148, 8); // first fill with spaces

        // add up header bytes
        let header = new Uint8Array(this.buffer, header_offset, 512);
        let chksum = 0;
        for (let i = 0; i < 512; i++) {
            chksum += header[i];
        }
        this._writeString(chksum.toString(8), header_offset + 148, 8);
    }

    _getOpt(opts: any, opname: string, defaultVal: any): any {
        if (opts != null) {
            if (opts[opname] != null) {
                return opts[opname];
            }
        }
        return defaultVal;
    }

    _fillHeader(header_offset: number, opts: any, fileType: string) {
        let uid = this._getOpt(opts, "uid", 1000);
        let gid = this._getOpt(opts, "gid", 1000);
        let mode = this._getOpt(opts, "mode", fileType === "file" ? "664" : "775");
        let mtime = this._getOpt(opts, "mtime", Date.now());
        let user = this._getOpt(opts, "user", "tarballjs");
        let group = this._getOpt(opts, "group", "tarballjs");

        this._writeFileMode(mode, header_offset);
        this._writeFileUid(uid.toString(8), header_offset);
        this._writeFileGid(gid.toString(8), header_offset);
        this._writeFileMtime(Number(Math.trunc(mtime / 1000).toString(8)), header_offset);

        this._writeString("ustar", header_offset + 257, 6); // magic string
        this._writeString("00", header_offset + 263, 2); // magic version

        this._writeFileUser(user, header_offset);
        this._writeFileGroup(group, header_offset);
    }
};

