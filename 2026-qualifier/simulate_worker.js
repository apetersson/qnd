"use strict";
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var worker_threads_1 = require("worker_threads");
// The workerData contains the config and simulation parameters
var rawCfg = worker_threads_1.workerData.cfg, startIdx = worker_threads_1.workerData.startIdx, endIdx = worker_threads_1.workerData.endIdx;
// Re-create methods and Map on the cfg object in the worker context
var cfg = __assign(__assign({}, rawCfg), { teamIdx: new Map(rawCfg.teamIdx) });
// Redefine methods that couldn't be cloned
Object.assign(cfg, {
    eloWinProb: function (rA, rB) {
        return 1 / (1 + Math.pow(10, (rB - rA) / 400));
    },
    drawProb: function (deltaElo) {
        var w = 1 / (1 + Math.pow(10, -deltaElo / 400));
        return 2 * w * (1 - w) * this.drawR;
    }
});
var TEAMS = cfg.teams;
var tally = TEAMS.reduce(function (acc, t) {
    var _a;
    return (__assign(__assign({}, acc), (_a = {}, _a[t] = { direct: 0, playoff: 0, fail: 0 }, _a)));
}, {});
for (var s = startIdx; s < endIdx; s++) {
    var pts = __spreadArray([], cfg.basePts, true);
    for (var _i = 0, _a = cfg.precomputedFixtures; _i < _a.length; _i++) {
        var _b = _a[_i], homeIdx = _b[0], awayIdx = _b[1], pHome = _b[2], pDraw = _b[3];
        var r = Math.random();
        if (r < pHome) {
            pts[homeIdx] += 3;
        }
        else if (r < pHome + pDraw) {
            pts[homeIdx] += 1;
            pts[awayIdx] += 1;
        }
        else {
            pts[awayIdx] += 3;
        }
    }
    var teamScores = [];
    for (var i = 0; i < pts.length; i++) {
        teamScores.push({ points: pts[i], tiebreaker: Math.random(), index: i });
    }
    teamScores.sort(function (a, b) {
        if (b.points !== a.points)
            return b.points - a.points;
        return a.tiebreaker - b.tiebreaker;
    });
    tally[TEAMS[teamScores[0].index]].direct++;
    tally[TEAMS[teamScores[1].index]].playoff++;
    for (var i = 2; i < teamScores.length; i++) {
        tally[TEAMS[teamScores[i].index]].fail++;
    }
}
worker_threads_1.parentPort.postMessage(tally);
