var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
// Document source type validator
var documentSource = v.union(v.literal("email"), v.literal("upload"), v.literal("portal"), v.literal("api"));
// Processing status type validator
var processingStatus = v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed"));
// Get document by ID
export var getById = query({
    args: { id: v.id("cocDocuments") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.get(args.id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get document by ID with related data
export var getByIdWithDetails = query({
    args: { id: v.id("cocDocuments") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var doc, _a, subcontractor, project, verification;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, ctx.db.get(args.id)];
                case 1:
                    doc = _b.sent();
                    if (!doc)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, Promise.all([
                            ctx.db.get(doc.subcontractorId),
                            ctx.db.get(doc.projectId),
                            ctx.db
                                .query("verifications")
                                .withIndex("by_document", function (q) { return q.eq("cocDocumentId", args.id); })
                                .first(),
                        ])];
                case 2:
                    _a = _b.sent(), subcontractor = _a[0], project = _a[1], verification = _a[2];
                    return [2 /*return*/, __assign(__assign({}, doc), { subcontractor: subcontractor, project: project, verification: verification })];
            }
        });
    }); },
});
// Get documents by subcontractor
export var getBySubcontractor = query({
    args: { subcontractorId: v.id("subcontractors") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("cocDocuments")
                        .withIndex("by_subcontractor", function (q) { return q.eq("subcontractorId", args.subcontractorId); })
                        .order("desc")
                        .collect()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get documents by project
export var getByProject = query({
    args: { projectId: v.id("projects") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("cocDocuments")
                        .withIndex("by_project", function (q) { return q.eq("projectId", args.projectId); })
                        .order("desc")
                        .collect()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get documents by subcontractor and project
export var getBySubcontractorAndProject = query({
    args: {
        subcontractorId: v.id("subcontractors"),
        projectId: v.id("projects"),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("cocDocuments")
                        .withIndex("by_subcontractor_project", function (q) {
                        return q.eq("subcontractorId", args.subcontractorId).eq("projectId", args.projectId);
                    })
                        .order("desc")
                        .collect()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get documents by processing status
export var getByProcessingStatus = query({
    args: { status: processingStatus },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("cocDocuments")
                        .withIndex("by_processing_status", function (q) { return q.eq("processingStatus", args.status); })
                        .collect()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get pending documents (for processing queue)
export var getPending = query({
    args: {},
    handler: function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("cocDocuments")
                        .withIndex("by_processing_status", function (q) { return q.eq("processingStatus", "pending"); })
                        .take(100)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Create document
export var create = mutation({
    args: {
        subcontractorId: v.id("subcontractors"),
        projectId: v.id("projects"),
        fileUrl: v.string(),
        fileName: v.optional(v.string()),
        fileSize: v.optional(v.number()),
        storageId: v.optional(v.id("_storage")),
        source: documentSource,
        sourceEmail: v.optional(v.string()),
        receivedAt: v.optional(v.number()),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var docId;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, ctx.db.insert("cocDocuments", {
                        subcontractorId: args.subcontractorId,
                        projectId: args.projectId,
                        fileUrl: args.fileUrl,
                        fileName: args.fileName,
                        fileSize: args.fileSize,
                        storageId: args.storageId,
                        source: args.source,
                        sourceEmail: (_a = args.sourceEmail) === null || _a === void 0 ? void 0 : _a.toLowerCase(),
                        receivedAt: args.receivedAt || Date.now(),
                        processedAt: undefined,
                        processingStatus: "pending",
                        updatedAt: Date.now(),
                    })];
                case 1:
                    docId = _b.sent();
                    return [2 /*return*/, docId];
            }
        });
    }); },
});
// Update document processing status
export var updateProcessingStatus = mutation({
    args: {
        id: v.id("cocDocuments"),
        processingStatus: processingStatus,
        processedAt: v.optional(v.number()),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.patch(args.id, {
                        processingStatus: args.processingStatus,
                        processedAt: args.processedAt || (args.processingStatus === "completed" ? Date.now() : undefined),
                        updatedAt: Date.now(),
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
// Update document
export var update = mutation({
    args: {
        id: v.id("cocDocuments"),
        fileUrl: v.optional(v.string()),
        fileName: v.optional(v.string()),
        fileSize: v.optional(v.number()),
        storageId: v.optional(v.id("_storage")),
        source: v.optional(documentSource),
        sourceEmail: v.optional(v.string()),
        receivedAt: v.optional(v.number()),
        processedAt: v.optional(v.number()),
        processingStatus: v.optional(processingStatus),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var id, updates, filteredUpdates;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    id = args.id, updates = __rest(args
                    // Normalize email
                    , ["id"]);
                    // Normalize email
                    if (updates.sourceEmail) {
                        updates.sourceEmail = updates.sourceEmail.toLowerCase();
                    }
                    filteredUpdates = Object.fromEntries(Object.entries(updates).filter(function (_a) {
                        var _ = _a[0], v = _a[1];
                        return v !== undefined;
                    }));
                    return [4 /*yield*/, ctx.db.patch(id, __assign(__assign({}, filteredUpdates), { updatedAt: Date.now() }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/, id];
            }
        });
    }); },
});
// Delete document
export var remove = mutation({
    args: { id: v.id("cocDocuments") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var verifications, _i, verifications_1, verification;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("verifications")
                        .withIndex("by_document", function (q) { return q.eq("cocDocumentId", args.id); })
                        .collect()];
                case 1:
                    verifications = _a.sent();
                    _i = 0, verifications_1 = verifications;
                    _a.label = 2;
                case 2:
                    if (!(_i < verifications_1.length)) return [3 /*break*/, 5];
                    verification = verifications_1[_i];
                    return [4 /*yield*/, ctx.db.delete(verification._id)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: 
                // Delete the document
                return [4 /*yield*/, ctx.db.delete(args.id)];
                case 6:
                    // Delete the document
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
// Get latest document for subcontractor-project pair
export var getLatest = query({
    args: {
        subcontractorId: v.id("subcontractors"),
        projectId: v.id("projects"),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("cocDocuments")
                        .withIndex("by_subcontractor_project", function (q) {
                        return q.eq("subcontractorId", args.subcontractorId).eq("projectId", args.projectId);
                    })
                        .order("desc")
                        .first()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Generate upload URL for file storage
export var generateUploadUrl = mutation({
    args: {},
    handler: function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.storage.generateUploadUrl()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get file URL from storage ID
export var getFileUrl = query({
    args: { storageId: v.id("_storage") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.storage.getUrl(args.storageId)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
