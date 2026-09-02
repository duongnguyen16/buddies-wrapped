#!/usr/bin/env node

/**
 * ==============================================================================
 * HALL OF BUDDIES - CHAT EXPLORER OVERVIEW & LEADERBOARD EXPORTER
 * A tiny script by Duncuti 🐱
 * ==============================================================================
 * 
 * Standalone, 100% zero-dependency script with Claude Aesthetic Dark UI.
 * Pre-renders all data statically (flat, no card wrappers on tables, English).
 * Features rich Key Insights, fun real-world equivalents, and advanced metrics.
 * 
 * Usage:
 *     node export-overview.js
 * 
 * ==============================================================================
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { exec } = require("child_process");

function openFile(filePath) {
  const platform = process.platform;
  let cmd = "";
  if (platform === "darwin") {
    cmd = `open "${filePath}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${filePath}"`;
  } else {
    cmd = `xdg-open "${filePath}"`;
  }
  exec(cmd, () => {});
}

// CP1252 to Byte map for Facebook Messenger UTF-8 Mojibake decoding
const CP1252_MAP = {
  "\u20AC": 0x80, "\u201A": 0x82, "\u0192": 0x83, "\u201E": 0x84,
  "\u2026": 0x85, "\u2020": 0x86, "\u2021": 0x87, "\u02C6": 0x88,
  "\u2030": 0x89, "\u0160": 0x8A, "\u2039": 0x8B, "\u0152": 0x8C,
  "\u017D": 0x8E, "\u2018": 0x91, "\u2019": 0x92, "\u201C": 0x93,
  "\u201D": 0x94, "\u2022": 0x95, "\u2013": 0x96, "\u2014": 0x97,
  "\u02DC": 0x98, "\u2122": 0x99, "\u0161": 0x9A, "\u203A": 0x9B,
  "\u0153": 0x9C, "\u017E": 0x9E, "\u0178": 0x9F
};

function stringToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (CP1252_MAP[ch] !== undefined) bytes.push(CP1252_MAP[ch]);
    else {
      const code = str.charCodeAt(i);
      if (code <= 255) bytes.push(code);
      else return null;
    }
  }
  return Buffer.from(bytes);
}


function areNamesEqual(a, b) {
  if (!a || !b) return false;
  const s1 = String(a).trim().toLowerCase();
  const s2 = String(b).trim().toLowerCase();
  if (s1 === s2) return true;
  const clean1 = s1.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const clean2 = s2.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (clean1 === clean2) return true;
  const words1 = clean1.split(/\s+/).sort().join(" ");
  const words2 = clean2.split(/\s+/).sort().join(" ");
  return words1 === words2;
}

function normalizeLegacyText(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (!str) return "";
  const bytes = stringToBytes(str);
  if (bytes) {
    try {
      const decoded = bytes.toString("utf8");
      if (!decoded.includes("\uFFFD") && decoded !== str) {
        return decoded.normalize("NFC");
      }
    } catch (_e) {}
  }
  return str.normalize("NFC");
}

const LOW_QUALITY_PATTERNS = [
  /^(ok|uk|uh|ừ|uhm|um|k|ko|hong|đc|dc|v|va|vs|dạ|da|ha|he|hic|huhu|haha|hihi|lol|\.|\?|!|\+)+$/i,
  /^[\p{Emoji}\s\d.,!?-]+$/u,
];

function isQualityMessage(text, msg) {
  if (!text && (msg.photos || msg.image || msg.videos || msg.video || msg.audio_files)) {
    return true;
  }
  const clean = (text || "").trim();
  if (clean.length < 5) return false;
  if (clean.length >= 18) return true;
  for (const pattern of LOW_QUALITY_PATTERNS) {
    if (pattern.test(clean)) return false;
  }
  const words = clean.split(/\s+/).filter(Boolean);
  return words.length >= 3;
}

function formatReplyTime(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) {
    return "N/A";
  }
  const s = Number(seconds);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) {
    const mins = Math.floor(s / 60);
    const secs = Math.round(s % 60);
    return mins < 5 && secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hrs = Math.floor(s / 3600);
  const mins = Math.round((s % 3600) / 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatDate(d) {
  if (!d || isNaN(new Date(d).getTime())) return "N/A";
  const dateObj = new Date(d);
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDuration(days) {
  if (!days || days <= 0) return "0 days";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const dRem = days % 30;
  if (years > 0) return months > 0 ? `${years}y ${months}m` : `${years}y`;
  if (months > 0) return dRem > 0 ? `${months}m ${dRem}d` : `${months}m`;
  return `${dRem}d`;
}

function formatChars(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

// Find all candidate JSON files in directory and known subdirectories
function discoverJsonFiles(searchDir) {
  const jsonFiles = [];
  const candidateDirs = [searchDir];

  const commonSubdirs = ["mdata-new", "inbox", "messages", "data", "json"];
  for (const sub of commonSubdirs) {
    const p = path.join(searchDir, sub);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      candidateDirs.push(p);
    }
  }

  for (const dir of candidateDirs) {
    try {
      const list = fs.readdirSync(dir);
      for (const item of list) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && item.endsWith(".json") && !item.startsWith("package") && !item.startsWith("tsconfig")) {
          jsonFiles.push(fullPath);
        } else if (stat.isDirectory() && !item.startsWith(".") && item !== "node_modules" && item !== "build" && item !== "src-tauri") {
          try {
            const subItems = fs.readdirSync(fullPath);
            for (const subFile of subItems) {
              if (subFile.endsWith(".json")) {
                jsonFiles.push(path.join(fullPath, subFile));
              }
            }
          } catch (_e) {}
        }
      }
    } catch (_e) {}
  }

  return [...new Set(jsonFiles)];
}


function detectSenderIdentity(files) {
  const senderConvs = {};
  const senderMsgs = {};
  const sample = files.slice(0, Math.min(files.length, 100));
  for (const f of sample) {
    try {
      const raw = fs.readFileSync(f, "utf-8");
      const data = JSON.parse(raw);
      const msgs = data.messages || (Array.isArray(data) ? data : []);
      const sendersInFile = new Set();
      for (const m of msgs) {
        const s = normalizeLegacyText(m.sender_name || m.sender || "");
        if (s) {
          sendersInFile.add(s);
          senderMsgs[s] = (senderMsgs[s] || 0) + 1;
        }
      }
      for (const s of sendersInFile) {
        senderConvs[s] = (senderConvs[s] || 0) + 1;
      }
    } catch (_e) {}
  }
  const candidates = Object.entries(senderConvs)
    .sort((a, b) => b[1] - a[1] || (senderMsgs[b[0]] || 0) - (senderMsgs[a[0]] || 0))
    .map(x => x[0]);
  return {
    identity: candidates[0] || "You",
    candidates: candidates.slice(0, 4)
  };
}
function detectMyName(files) {
  return detectSenderIdentity(files).identity;
}


function analyzeConversation(filePath, myName) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    const msgs = data.messages || (Array.isArray(data) ? data : []);
    if (!Array.isArray(msgs) || msgs.length === 0) return null;

    const baseFileName = path.basename(filePath, ".json");
    let displayName = normalizeLegacyText(data.name || data.title || baseFileName);
    if (displayName.toLowerCase().startsWith("message_") || displayName === "messages") {
      displayName = normalizeLegacyText(path.basename(path.dirname(filePath)));
    }
    // Clean up trailing export indices like "Thao Xuan Dao_37" -> "Thao Xuan Dao"
    displayName = displayName.replace(/_\d+$/, "").trim();

    const normalizedMyName = normalizeLegacyText(myName).toLowerCase();

    const sortedMsgs = [...msgs].sort((a, b) => {
      const tA = new Date(a.timestamp || a.timestamp_ms || 0).getTime();
      const tB = new Date(b.timestamp || b.timestamp_ms || 0).getTime();
      return tA - tB;
    });

    let totalChars = 0;
    let totalWords = 0;
    let longestMsgChars = 0;
    let qualityMessagesCount = 0;
    let oppositeMsgs = 0;
    let oppositeQuality = 0;
    let oppositeChars = 0;
    let oppositeLongestMsg = 0;
    let myMsgs = 0;
    let myChars = 0;
    let myLongestMsg = 0;

    let nightOwlMsgs = 0; // 11 PM to 4 AM
    let witchingHourMsgs = 0; // 2 AM to 4 AM
    let earlyBirdMsgs = 0; // 5 AM to 9 AM
    let weekendMsgs = 0; // Sat, Sun

    let laughCount = 0;
    let questionCount = 0;
    let ellipsisCount = 0;
    let capsCount = 0;
    let mediaCount = 0;
    let doubleTextCount = 0;

    let maxBurstCount = 0;
    let currentBurstCount = 0;
    let currentBurstSender = null;

    const dayCounts = {};
    const dayCountsOpp = {};
    const dayCountsMy = {};
    const dayCountsNight = {};
    const dayCountsQuality = {};
    const dayCountsChars = {};
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
    const monthCounts = {};
    const dayReplies = {};
    let lastMyTimestamp = null;
    let maxGhostingGapDays = 0;

    let globalMinTs = null;
    let globalMaxTs = null;

    for (let i = 0; i < sortedMsgs.length; i++) {
      const m = sortedMsgs[i];
      const rawText = m.message ?? m.content ?? m.text ?? "";
      const text = normalizeLegacyText(rawText);
      const len = text.length;
      totalChars += len;

      if (text.trim()) {
        const words = text.trim().split(/\s+/).filter(Boolean);
        totalWords += words.length;
      }

      const isQual = isQualityMessage(text, m);
      if (isQual) qualityMessagesCount++;

      if (/(haha|hihi|hehe|huhu|keke|kkk|lol|lmao|😂|🤣|😆)/i.test(text)) laughCount++;
      if (text.includes("?")) questionCount++;
      if (text.includes("...") || text.includes("…")) ellipsisCount++;
      if (len >= 6 && text === text.toUpperCase() && /[A-ZÀ-Ỹ]/.test(text)) capsCount++;

      const mediaAttachments = (m.photos?.length || 0) + (m.videos?.length || 0) + (m.audio_files?.length || 0) + (m.files?.length || 0) + (m.share ? 1 : 0);
      mediaCount += mediaAttachments;

      const rawSender = m.sender || m.sender_name || m.senderName || "";
      const sender = normalizeLegacyText(rawSender);
      const isMe = areNamesEqual(sender, myName);

      const tsMs = new Date(m.timestamp || m.timestamp_ms || 0).getTime();

      if (!isNaN(tsMs) && tsMs > 0) {
        if (globalMinTs === null || tsMs < globalMinTs) globalMinTs = tsMs;
        if (globalMaxTs === null || tsMs > globalMaxTs) globalMaxTs = tsMs;

        const d = new Date(tsMs);
        const hour = d.getHours();
        const dayOfWeek = d.getDay(); // 0 is Sun, 6 is Sat

        if (hour >= 23 || hour < 4) nightOwlMsgs++;
        if (hour >= 2 && hour < 4) witchingHourMsgs++;
        if (hour >= 5 && hour < 9) earlyBirdMsgs++;
        if (dayOfWeek === 0 || dayOfWeek === 6) weekendMsgs++;

        dayOfWeekCounts[dayOfWeek]++;
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;

        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        dayCounts[dateKey] = (dayCounts[dateKey] || 0) + 1;
        dayCountsChars[dateKey] = (dayCountsChars[dateKey] || 0) + len;
        if (isMe) {
          dayCountsMy[dateKey] = (dayCountsMy[dateKey] || 0) + 1;
        } else {
          dayCountsOpp[dateKey] = (dayCountsOpp[dateKey] || 0) + 1;
        }
        if (hour >= 23 || hour < 4) {
          dayCountsNight[dateKey] = (dayCountsNight[dateKey] || 0) + 1;
        }
        if (isQual) {
          dayCountsQuality[dateKey] = (dayCountsQuality[dateKey] || 0) + 1;
        }

        if (i > 0) {
          const prevTs = new Date(sortedMsgs[i - 1].timestamp || sortedMsgs[i - 1].timestamp_ms || 0).getTime();
          if (prevTs > 0) {
            const gapDays = Math.floor((tsMs - prevTs) / (1000 * 60 * 60 * 24));
            if (gapDays > maxGhostingGapDays) maxGhostingGapDays = gapDays;
          }
        }
      }

      // Consecutive message burst tracking
      const currentSenderKey = isMe ? "me" : "them";
      if (currentSenderKey === currentBurstSender) {
        currentBurstCount++;
        if (currentBurstCount > 1) doubleTextCount++;
      } else {
        currentBurstSender = currentSenderKey;
        currentBurstCount = 1;
      }
      if (currentBurstCount > maxBurstCount) {
        maxBurstCount = currentBurstCount;
      }

      if (isMe) {
        myMsgs++;
        myChars += len;
        if (len > myLongestMsg) myLongestMsg = len;
        if (!isNaN(tsMs) && tsMs > 0) lastMyTimestamp = tsMs;
      } else {
        oppositeMsgs++;
        oppositeChars += len;
        if (len > oppositeLongestMsg) oppositeLongestMsg = len;
        if (isQual) oppositeQuality++;

        if (!isNaN(tsMs) && tsMs > 0) {
          const d = new Date(tsMs);
          const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          if (lastMyTimestamp !== null) {
            const deltaSeconds = (tsMs - lastMyTimestamp) / 1000;
            lastMyTimestamp = null;
            if (deltaSeconds >= 1 && deltaSeconds <= 24 * 3600) {
              if (!dayReplies[dateKey]) dayReplies[dateKey] = [];
              dayReplies[dateKey].push(deltaSeconds);
            }
          }
        }
      }

      if (len > longestMsgChars) longestMsgChars = len;
    }

    let avgReplySecs = null;
    const days = Object.keys(dayReplies);
    if (days.length > 0) {
      let sum = 0;
      for (const d of days) {
        sum += dayReplies[d].reduce((a, b) => a + b, 0) / dayReplies[d].length;
      }
      avgReplySecs = sum / days.length;
    }

    const uniqueDates = Object.keys(dayCounts).sort();
    let maxStreak = 0;
    let currentStreak = 0;
    let peakDayCount = 0;
    let peakDayDate = "";

    for (const [dateKey, count] of Object.entries(dayCounts)) {
      if (count > peakDayCount) {
        peakDayCount = count;
        peakDayDate = dateKey;
      }
    }

    for (let i = 0; i < uniqueDates.length; i++) {
      const curDate = new Date(uniqueDates[i]);
      if (i === 0) currentStreak = 1;
      else {
        const prevDate = new Date(uniqueDates[i - 1]);
        const diffDays = Math.round((curDate - prevDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) currentStreak++;
        else currentStreak = 1;
      }
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    }

    let timeSpanDays = 0;
    let timeSpanFormatted = "0d";
    if (globalMinTs && globalMaxTs) {
      timeSpanDays = Math.max(1, Math.round((globalMaxTs - globalMinTs) / (1000 * 60 * 60 * 24)));
      const years = Math.floor(timeSpanDays / 365);
      const months = Math.floor((timeSpanDays % 365) / 30);
      const dRem = timeSpanDays % 30;
      if (years > 0) timeSpanFormatted = months > 0 ? `${years}y ${months}m` : `${years}y`;
      else if (months > 0) timeSpanFormatted = dRem > 0 ? `${months}m ${dRem}d` : `${months}m`;
      else timeSpanFormatted = `${dRem}d`;
    }

    const activeDaysCount = Math.max(uniqueDates.length, 1);
    const dramaticScore = sortedMsgs.length / activeDaysCount;
    const qualityRatio = sortedMsgs.length > 0 ? qualityMessagesCount / sortedMsgs.length : 0;
    const qualityPercent = Math.round(qualityRatio * 100);
    const balanceFactor = Math.min(myMsgs, oppositeMsgs) / Math.max(myMsgs, oppositeMsgs, 1);
    const avgCombinedChars = sortedMsgs.length > 0 ? totalChars / sortedMsgs.length : 0;
    const daysSinceLastMsg = globalMaxTs ? Math.floor((Date.now() - globalMaxTs) / (1000 * 60 * 60 * 24)) : 0;

    // Best Value Score calculation (0 to 100 pts)
    const volLog = Math.min(30, (Math.log10(Math.max(1, sortedMsgs.length)) / 5.2) * 15 + (Math.log10(Math.max(1, totalChars)) / 6.5) * 15);
    const qualPts = qualityRatio * 25;
    const streakPts = Math.min(12, (maxStreak / 60) * 12);
    const activeDaysPts = Math.min(8, (activeDaysCount / 300) * 8);
    const consistencyPts = streakPts + activeDaysPts;
    const dramaticPts = Math.min(10, (Math.log10(Math.max(1, dramaticScore)) / 2.5) * 10);
    const peakPts = Math.min(5, (Math.log10(Math.max(1, peakDayCount)) / 3.2) * 5);
    const intensityPts = dramaticPts + peakPts;
    const balancePts = balanceFactor * 10;
    const overallScore = Math.min(100, Math.max(1, Math.round((volLog + qualPts + consistencyPts + intensityPts + balancePts) * 10) / 10));

    return {
      file: filePath,
      name: displayName,
      totalMsgs: sortedMsgs.length,
      totalWords,
      myMsgs,
      oppositeMsgs,
      totalChars,
      myChars,
      oppositeChars,
      charDiff: myChars - oppositeChars,
      longestMsgChars,
      myLongestMsg,
      oppositeLongestMsg,
      qualityMessagesCount,
      qualityPercent,
      oppositeQuality,
      oppQualityPercent: oppositeMsgs > 0 ? (oppositeQuality / oppositeMsgs) * 100 : 0,
      oppLowQualityPercent: oppositeMsgs > 0 ? 100 - (oppositeQuality / oppositeMsgs) * 100 : 0,
      myShare: (myMsgs / sortedMsgs.length) * 100,
      oppShare: (oppositeMsgs / sortedMsgs.length) * 100,
      avgCharsOpp: oppositeMsgs > 0 ? oppositeChars / oppositeMsgs : 0,
      avgCombinedChars,
      avgReplySecs,
      avgReplyFormatted: formatReplyTime(avgReplySecs),
      maxStreak,
      peakDayCount,
      peakDayDate,
      nightOwlMsgs,
      nightOwlPercent: sortedMsgs.length > 0 ? (nightOwlMsgs / sortedMsgs.length) * 100 : 0,
      witchingHourMsgs,
      earlyBirdMsgs,
      earlyBirdPercent: sortedMsgs.length > 0 ? (earlyBirdMsgs / sortedMsgs.length) * 100 : 0,
      weekendMsgs,
      weekendPercent: sortedMsgs.length > 0 ? (weekendMsgs / sortedMsgs.length) * 100 : 0,
      laughCount,
      questionCount,
      ellipsisCount,
      capsCount,
      mediaCount,
      doubleTextCount,
      dayCounts,
      dayCountsOpp,
      dayCountsMy,
      dayCountsNight,
      dayCountsQuality,
      dayCountsChars,
      daysSinceLastMsg,
      maxBurstCount,
      firstDate: formatDate(globalMinTs),
      lastDate: formatDate(globalMaxTs),
      firstTs: globalMinTs,
      lastTs: globalMaxTs,
      timeSpanDays,
      timeSpanFormatted,
      activeDaysCount,
      dramaticScore,
      balanceFactor,
      overallScore,
      maxGhostingGapDays,
    };
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return null;
  }
}

function createPrompter() {
  const lines = [];
  let waiting = null;
  let closed = false;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on("line", (line) => {
    if (waiting) {
      const cb = waiting;
      waiting = null;
      cb(line.trim());
    } else {
      lines.push(line.trim());
    }
  });

  rl.on("close", () => {
    closed = true;
    if (waiting) {
      const cb = waiting;
      waiting = null;
      cb("");
    }
  });

  return {
    ask: (questionText) => {
      process.stdout.write(questionText);
      return new Promise((resolve) => {
        if (lines.length > 0) {
          resolve(lines.shift());
        } else if (closed) {
          resolve("");
        } else {
          waiting = resolve;
        }
      });
    },
    close: () => {
      rl.close();
    }
  };
}

function getCategoriesConfig(lang = 'EN') {
  const isVi = lang === 'VI';
  return [
    {
      id: "best-value",
      title: isVi ? "Điểm Giá Trị Tổng Hợp" : "Best Value Score",
      sortFn: (a, b) => b.overallScore - a.overallScore,
      valFn: item => `${item.overallScore} pts`,
      metaFn: item => isVi ? `${item.totalMsgs.toLocaleString()} tin · ${item.qualityPercent}% chất lượng` : `${item.totalMsgs.toLocaleString()} msgs · ${item.qualityPercent}% qual`
    },
    {
      id: "opp-msgs",
      title: isVi ? "Tin Nhắn Do Đối Phương Gửi" : "Messages Sent by Them",
      sortFn: (a, b) => b.oppositeMsgs - a.oppositeMsgs,
      valFn: item => isVi ? `${item.oppositeMsgs.toLocaleString()} tin` : `${item.oppositeMsgs.toLocaleString()} msgs`,
      metaFn: item => isVi ? `${item.oppShare.toFixed(1)}% toàn bộ cuộc trò chuyện` : `${item.oppShare.toFixed(1)}% of conversation`
    },
    {
      id: "opp-qual",
      title: isVi ? "Tin Nhắn Chất Lượng Từ Họ" : "Quality Messages from Them",
      sortFn: (a, b) => b.oppositeQuality - a.oppositeQuality,
      valFn: item => isVi ? `${item.oppositeQuality.toLocaleString()} tin` : `${item.oppositeQuality.toLocaleString()} msgs`,
      metaFn: item => isVi ? `${item.oppQualityPercent.toFixed(1)}% tỷ lệ chất lượng` : `${item.oppQualityPercent.toFixed(1)}% quality rate`
    },
    {
      id: "opp-chars",
      title: isVi ? "Ký Tự Do Đối Phương Viết" : "Characters Written by Them",
      sortFn: (a, b) => b.oppositeChars - a.oppositeChars,
      valFn: item => `${formatChars(item.oppositeChars)} chars`,
      metaFn: item => isVi ? `${item.oppositeChars.toLocaleString()} ký tự` : `${item.oppositeChars.toLocaleString()} characters`
    },
    {
      id: "reply-time",
      title: isVi ? "Tốc Độ Trả Lời (Họ → Tôi)" : "Reply Speed (Them → Me)",
      sortFn: (a, b) => (a.avgReplySecs || 9999999) - (b.avgReplySecs || 9999999),
      filterFn: x => x.avgReplySecs !== null && x.avgReplySecs > 0,
      valFn: item => item.avgReplyFormatted,
      metaFn: item => isVi ? `Trung bình ${Math.round(item.avgReplySecs)} giây` : `${Math.round(item.avgReplySecs)}s average`
    },
    {
      id: "night-owl",
      title: isVi ? "Quán Quân Cú Đêm (23h - 4h)" : "Night Owl Champion (11 PM - 4 AM)",
      sortFn: (a, b) => b.nightOwlMsgs - a.nightOwlMsgs,
      valFn: item => isVi ? `${item.nightOwlMsgs.toLocaleString()} tin` : `${item.nightOwlMsgs.toLocaleString()} msgs`,
      metaFn: item => isVi ? `${item.nightOwlPercent.toFixed(1)}% tổng số tin nhắn của họ` : `${item.nightOwlPercent.toFixed(1)}% of all their messages`
    },
    {
      id: "early-bird",
      title: isVi ? "Quán Quân Dậy Sớm (5h - 9h)" : "Early Bird Champion (5 AM - 9 AM)",
      sortFn: (a, b) => b.earlyBirdMsgs - a.earlyBirdMsgs,
      valFn: item => isVi ? `${item.earlyBirdMsgs.toLocaleString()} tin` : `${item.earlyBirdMsgs.toLocaleString()} msgs`,
      metaFn: item => isVi ? `${item.earlyBirdPercent.toFixed(1)}% vào sáng sớm` : `${item.earlyBirdPercent.toFixed(1)}% in early morning`
    },
    {
      id: "weekend-warrior",
      title: isVi ? "Tỷ Trọng Nhắn Cuối Tuần" : "Weekend Chat Intensity",
      sortFn: (a, b) => b.weekendMsgs - a.weekendMsgs,
      valFn: item => isVi ? `${item.weekendMsgs.toLocaleString()} tin` : `${item.weekendMsgs.toLocaleString()} msgs`,
      metaFn: item => isVi ? `${item.weekendPercent.toFixed(1)}% vào cuối tuần` : `${item.weekendPercent.toFixed(1)}% on weekends`
    },
    {
      id: "rapid-burst",
      title: isVi ? "Bắn Tin Nhắn Liên Thanh" : "Rapid-Fire Message Bursts",
      sortFn: (a, b) => b.maxBurstCount - a.maxBurstCount,
      valFn: item => isVi ? `${item.maxBurstCount} tin liên tiếp` : `${item.maxBurstCount} msgs in a row`,
      metaFn: item => isVi ? "Lượt gửi tin liên tục dài nhất" : "Longest non-stop single burst"
    },
    {
      id: "longest-single",
      title: isVi ? "Tin Nhắn Đơn Dài Nhất" : "Longest Single Monologue",
      sortFn: (a, b) => b.longestMsgChars - a.longestMsgChars,
      valFn: item => `${item.longestMsgChars.toLocaleString()} chars`,
      metaFn: item => isVi ? "Một tin nhắn văn bản dài nhất" : "Single longest typed message"
    },
    {
      id: "opp-share",
      title: isVi ? "Tỷ Lệ Đối Phương Gửi Cao Nhất" : "Highest Opposite Share (% They Sent)",
      sortFn: (a, b) => b.oppShare - a.oppShare,
      filterFn: x => x.totalMsgs >= 200 && x.oppositeMsgs >= 50,
      valFn: item => `${item.oppShare.toFixed(1)}%`,
      metaFn: item => isVi ? `Họ gửi ${item.oppositeMsgs.toLocaleString()} tin vs bạn gửi ${item.myMsgs.toLocaleString()} tin` : `${item.oppositeMsgs.toLocaleString()} sent vs ${item.myMsgs.toLocaleString()} by you`
    },
    {
      id: "active-days",
      title: isVi ? "Số Ngày Hoạt Động Nhiều Nhất" : "Most Active Calendar Days",
      sortFn: (a, b) => b.activeDaysCount - a.activeDaysCount,
      valFn: item => isVi ? `${item.activeDaysCount} ngày` : `${item.activeDaysCount} days`,
      metaFn: item => isVi ? "Số ngày có phát sinh tin nhắn" : "Distinct days with conversations"
    },
    {
      id: "avg-length-them",
      title: isVi ? "Độ Dài Tin Nhắn Trung Bình (Họ)" : "Average Message Length (Them)",
      sortFn: (a, b) => b.avgCharsOpp - a.avgCharsOpp,
      filterFn: x => x.oppositeMsgs >= 50,
      valFn: item => `${item.avgCharsOpp.toFixed(1)} ch/msg`,
      metaFn: item => isVi ? `${item.oppositeChars.toLocaleString()} ký tự qua ${item.oppositeMsgs.toLocaleString()} tin` : `${item.oppositeChars.toLocaleString()} chars over ${item.oppositeMsgs.toLocaleString()} msgs`
    },
    {
      id: "balance",
      title: isVi ? "Cân Bằng Tương Tác 50/50" : "Mutual Conversation Balance (50/50)",
      sortFn: (a, b) => b.balanceFactor - a.balanceFactor,
      filterFn: x => x.totalMsgs >= 200 && x.oppositeMsgs >= 50,
      valFn: item => isVi ? `${(item.balanceFactor * 100).toFixed(1)}% cân bằng` : `${(item.balanceFactor * 100).toFixed(1)}% balance`,
      metaFn: item => isVi ? `Bạn ${item.myShare.toFixed(1)}% vs Họ ${item.oppShare.toFixed(1)}%` : `${item.myShare.toFixed(1)}% you vs ${item.oppShare.toFixed(1)}% them`
    },
    {
      id: "total-msgs",
      title: isVi ? "Tổng Số Tin Nhắn (Cả 2 Bên)" : "Total Messages (Both Sides)",
      sortFn: (a, b) => b.totalMsgs - a.totalMsgs,
      valFn: item => isVi ? `${item.totalMsgs.toLocaleString()} tin` : `${item.totalMsgs.toLocaleString()} msgs`,
      metaFn: item => `${item.firstDate} → ${item.lastDate}`
    },
    {
      id: "quality-msgs",
      title: isVi ? "Tin Nhắn Chất Lượng (Cả 2 Bên)" : "Quality Messages (Both Sides)",
      sortFn: (a, b) => b.qualityMessagesCount - a.qualityMessagesCount,
      valFn: item => isVi ? `${item.qualityMessagesCount.toLocaleString()} tin` : `${item.qualityMessagesCount.toLocaleString()} msgs`,
      metaFn: item => isVi ? `${item.qualityPercent}% tỷ lệ chất lượng` : `${item.qualityPercent}% quality rate`
    },
    {
      id: "dramatic",
      title: isVi ? "Cường Độ Nhắn Tin Mỗi Ngày" : "Daily Intensity (Pacing)",
      sortFn: (a, b) => b.dramaticScore - a.dramaticScore,
      valFn: item => `${Math.round(item.dramaticScore)} msg/d`,
      metaFn: item => isVi ? `${item.activeDaysCount} ngày hoạt động` : `${item.activeDaysCount} active days`
    },
    {
      id: "streak",
      title: isVi ? "Chuỗi Ngày Nhắn Liên Tục" : "Longest Daily Streak",
      sortFn: (a, b) => b.maxStreak - a.maxStreak,
      valFn: item => isVi ? `${item.maxStreak} ngày` : `${item.maxStreak} days`,
      metaFn: item => isVi ? "Ngày liên tiếp không đứt quãng" : "Consecutive days"
    },
    {
      id: "peak-day",
      title: isVi ? "Kỷ Lục Ngày Bùng Nổ Nhất" : "Peak Day Record",
      sortFn: (a, b) => b.peakDayCount - a.peakDayCount,
      valFn: item => isVi ? `${item.peakDayCount.toLocaleString()} tin` : `${item.peakDayCount.toLocaleString()} msgs`,
      metaFn: item => isVi ? `vào ngày ${item.peakDayDate}` : `on ${item.peakDayDate}`
    },
    {
      id: "total-chars",
      title: isVi ? "Tổng Lượng Ký Tự (Cả 2 Bên)" : "Total Characters (Both Sides)",
      sortFn: (a, b) => b.totalChars - a.totalChars,
      valFn: item => `${formatChars(item.totalChars)} chars`,
      metaFn: item => isVi ? `${item.totalChars.toLocaleString()} ký tự` : `${item.totalChars.toLocaleString()} characters`
    },
    {
      id: "time-span",
      title: isVi ? "Thời Gian Đồng Hành Dài Nhất" : "Longest Friendship Span",
      sortFn: (a, b) => b.timeSpanDays - a.timeSpanDays,
      valFn: item => item.timeSpanFormatted,
      metaFn: item => isVi ? `${item.timeSpanDays.toLocaleString()} ngày gắn bó` : `${item.timeSpanDays.toLocaleString()} days span`
    }
  ];
}

function generateHtmlReport({
  conversations,
  startDateFormatted,
  endDateFormatted,
  totalDurationText,
  globalTotalDays,
  grandTotalMessages,
  grandTotalChars,
  grandTotalWords,
  topN,
  lang = 'EN',
  myName = ''
}) {
  const isVi = lang === 'VI';
  const categories = getCategoriesConfig(lang);

  const t = {
    title: "Buddies Wrapped",
    subtitle: isVi
      ? 'Một script nhỏ bởi <a href="https://github.com/duongnguyen16/buddies-wrapped" target="_blank" rel="noopener noreferrer" class="author-link">Duncuti</a> 🐱'
      : 'A tiny script by <a href="https://github.com/duongnguyen16/buddies-wrapped" target="_blank" rel="noopener noreferrer" class="author-link">Duncuti</a> 🐱',
    dateRange: (s, e) => isVi ? `${s} đến ${e}` : `${s} to ${e}`,
    kpiActiveTime: isVi ? "Khoảng Thời Gian" : "Active Time Span",
    kpiTotalDays: isVi ? "ngày hoạt động" : "active days",
    kpiTotalChats: isVi ? "Tổng Cuộc Trò Chuyện" : "Total Conversations",
    kpiParsedRanked: isVi ? "Đã xử lý & xếp hạng" : "Parsed & ranked",
    kpiTotalMsgs: isVi ? "Tổng Số Tin Nhắn" : "Total Messages",
    kpiSentRecv: isVi ? "Đã gửi & nhận" : "Sent & received",
    kpiTotalChars: isVi ? "Tổng Lượng Ký Tự" : "Total Characters",
    kpiCharsTyped: isVi ? "ký tự đã gõ" : "characters typed",
    tabInsights: isVi ? "Key Insights & Thống Kê" : "Key Insights & Fun Facts",
    tabAll: isVi ? "Bảng Xếp Hạng & Danh Mục" : "Leaderboard & Categories",
    tabGraph: isVi ? "Biểu Đồ Dòng Thời Gian" : "Timeline Graphs",
    tabOpposite: isVi ? "Từ Phía Đối Phương" : "Opposite Only (From Them)",
    tabRaw: isVi ? "Tất Cả Cuộc Trò Chuyện" : "All Conversations",
    graphTitle: isVi ? "Biểu Đồ Xu Hướng Theo Dòng Thời Gian" : "Timeline Trends & Activity Graphs",
    graphDesc: isVi ? "Theo dõi quỹ đạo tăng trưởng, khối lượng và nhịp điệu nhắn tin của top bạn bè theo thời gian." : "Interactive time-series trajectories tracking communication volume, growth, and rhythms across your top contacts.",
    graphMetric: isVi ? "Chỉ số:" : "Metric:",
    graphShowLines: isVi ? "Hiển thị:" : "Show Lines:",
    graphAggregation: isVi ? "Chu kỳ:" : "Aggregation:",
    metricAll: isVi ? "Tổng tin nhắn (Cả hai bên)" : "Total Messages (Both Sides)",
    metricGrowth: isVi ? "Tăng trưởng tích luỹ" : "Cumulative Message Growth",
    metricOpp: isVi ? "Tin nhắn đối phương gửi" : "Messages Sent by Them",
    metricMy: isVi ? "Tin nhắn bạn gửi" : "Messages Sent by You",
    metricNight: isVi ? "Tin nhắn đêm khuya (23h - 4h)" : "Late-Night Messages (11 PM - 4 AM)",
    metricQuality: isVi ? "Tin nhắn chất lượng" : "Quality Messages",
    metricChars: isVi ? "Khối lượng ký tự đã gõ" : "Character Volume Typed",
    top5: isVi ? "Top 5 Bạn bè" : "Top 5 Contacts",
    top10: isVi ? "Top 10 Bạn bè" : "Top 10 Contacts",
    top15: isVi ? "Top 15 Bạn bè" : "Top 15 Contacts",
    top20: isVi ? "Top 20 Bạn bè" : "Top 20 Contacts",
    topAll: isVi ? "Tất cả mọi người" : "All Contacts",
    aggWeekly: isVi ? "Theo tuần (Mượt mà)" : "Weekly Timeline (Smooth)",
    aggMonthly: isVi ? "Theo tháng" : "Monthly Timeline",
    aggDaily: isVi ? "Chi tiết theo ngày" : "Daily Detail",
    catRankings: isVi ? "Bảng Xếp Hạng Danh Mục" : "Category Rankings",
    display: isVi ? "Hiển thị:" : "Display:",
    searchContacts: isVi ? "Tìm kiếm bạn bè..." : "Search contacts...",
    oppTitle: isVi ? "Dữ Liệu Từ Phía Đối Phương (Không tính tin của bạn)" : "Data from Them Only (Excluding My Messages)",
    oppDesc: isVi ? "Xếp hạng 100% dựa trên tin nhắn, khối lượng và tốc độ trả lời do đối phương gửi:" : "Ranked 100% on messages, volume, and response speed sent by the other party:",
    thRank: "#",
    thContactThem: isVi ? "Đối Phương" : "Contact (Them)",
    thMsgsSent: isVi ? "Tin Nhắn Đã Gửi" : "Messages Sent",
    thQualMsgs: isVi ? "Tin Chất Lượng" : "Quality Msgs",
    thQualRate: isVi ? "Tỷ Lệ Chất Lượng" : "Quality Rate",
    thCharsWritten: isVi ? "Ký Tự Đã Viết" : "Chars Written",
    thAvgChars: isVi ? "Ký Tự/Tin TB" : "Avg Chars/Msg",
    thTheirShare: isVi ? "Tỷ Trọng Họ" : "Their Share",
    thReplySpeed: isVi ? "Tốc Độ Trả Lời" : "Reply Speed",
    thTimeRange: isVi ? "Thời Gian (Từ → Đến)" : "Time Range (From → To)",
    allTitle: (n) => isVi ? `Tất Cả ${n} Cuộc Trò Chuyện` : `All ${n} Conversations`,
    filterChats: isVi ? "Lọc cuộc trò chuyện..." : "Filter conversations...",
    thContactName: isVi ? "Tên Bạn Bè" : "Contact Name",
    thValueScore: isVi ? "Điểm Giá Trị" : "Value Score",
    thTotalMsgs: isVi ? "Tổng Tin Nhắn" : "Total Msgs",
    thYouSent: isVi ? "Bạn Đã Gửi" : "You Sent",
    thTheySent: isVi ? "Họ Đã Gửi" : "They Sent",
    thStreak: isVi ? "Chuỗi Ngày" : "Streak",
  };

  // Compute fun comparisons & facts
  const harryPotterChars = 6095000;
  const warAndPeaceChars = 3120000;
  const hpTimes = (grandTotalChars / harryPotterChars).toFixed(1);
  const wpTimes = (grandTotalChars / warAndPeaceChars).toFixed(1);
  const paperbackPages = Math.round(grandTotalChars / 2500);
  const bookVolumes = Math.max(1, Math.round(paperbackPages / 450));
  const typingHours = Math.round(grandTotalChars / 200 / 60); // 200 chars/min
  const typingDays = (typingHours / 24).toFixed(1);

  const totalTextKm = ((grandTotalChars * 2.1) / 1000000).toFixed(2);
  const totalTextMiles = (((grandTotalChars * 2.1) / 1000000) * 0.621371).toFixed(2);

  const top1VolumeContact = [...conversations].sort((a, b) => b.totalMsgs - a.totalMsgs)[0] || { name: "N/A", totalMsgs: 0 };
  const top1VolumePercent = grandTotalMessages > 0 ? ((top1VolumeContact.totalMsgs / grandTotalMessages) * 100).toFixed(1) : "0";

  const topFastestContact = [...conversations].filter(x => x.avgReplySecs !== null && x.avgReplySecs > 0).sort((a, b) => a.avgReplySecs - b.avgReplySecs)[0] || { name: "N/A", avgReplyFormatted: "N/A" };
  const topGhostContact = [...conversations].sort((a, b) => b.maxGhostingGapDays - a.maxGhostingGapDays)[0] || { name: "N/A", maxGhostingGapDays: 0 };
  const topNightOwlContact = [...conversations].sort((a, b) => b.nightOwlMsgs - a.nightOwlMsgs)[0] || { name: "N/A", nightOwlMsgs: 0 };
  const topEarlyBirdContact = [...conversations].sort((a, b) => b.earlyBirdMsgs - a.earlyBirdMsgs)[0] || { name: "N/A", earlyBirdMsgs: 0 };
  const topWeekendContact = [...conversations].sort((a, b) => b.weekendMsgs - a.weekendMsgs)[0] || { name: "N/A", weekendMsgs: 0 };
  const topMonologueContact = [...conversations].sort((a, b) => b.longestMsgChars - a.longestMsgChars)[0] || { name: "N/A", longestMsgChars: 0 };
  const topBurstContact = [...conversations].sort((a, b) => b.maxBurstCount - a.maxBurstCount)[0] || { name: "N/A", maxBurstCount: 0 };
  const topBalanceContact = [...conversations].filter(x => x.totalMsgs >= 200 && x.oppositeMsgs >= 50).sort((a, b) => b.balanceFactor - a.balanceFactor)[0] || { name: "N/A", balanceFactor: 0, myShare: 50, oppShare: 50, totalMsgs: 0 };
  const topStreakContact = [...conversations].sort((a, b) => b.maxStreak - a.maxStreak)[0] || { name: "N/A", maxStreak: 0 };
  const topPeakContact = [...conversations].sort((a, b) => b.peakDayCount - a.peakDayCount)[0] || { name: "N/A", peakDayCount: 0, peakDayDate: "N/A" };

  const globalQualityMsgs = conversations.reduce((acc, x) => acc + x.qualityMessagesCount, 0);
  const globalQualityPercent = grandTotalMessages > 0 ? Math.round((globalQualityMsgs / grandTotalMessages) * 100) : 0;
  const globalNightOwlMsgs = conversations.reduce((acc, x) => acc + x.nightOwlMsgs, 0);
  const globalNightOwlPercent = grandTotalMessages > 0 ? ((globalNightOwlMsgs / grandTotalMessages) * 100).toFixed(1) : "0";
  const globalWeekendMsgs = conversations.reduce((acc, x) => acc + x.weekendMsgs, 0);
  const globalWeekendPercent = grandTotalMessages > 0 ? ((globalWeekendMsgs / grandTotalMessages) * 100).toFixed(1) : "0";

  // Advanced Dynamics & Facts Computations
  const globalWitchingMsgs = conversations.reduce((acc, x) => acc + x.witchingHourMsgs, 0);
  const globalWitchingPercent = grandTotalMessages > 0 ? ((globalWitchingMsgs / grandTotalMessages) * 100).toFixed(1) : "0";
  const topWitchingContact = [...conversations].sort((a, b) => b.witchingHourMsgs - a.witchingHourMsgs)[0] || { name: "N/A", witchingHourMsgs: 0 };

  const globalLaughMsgs = conversations.reduce((acc, x) => acc + x.laughCount, 0);
  const globalLaughPercent = grandTotalMessages > 0 ? ((globalLaughMsgs / grandTotalMessages) * 100).toFixed(1) : "0";
  const topLaughContact = [...conversations].sort((a, b) => b.laughCount - a.laughCount)[0] || { name: "N/A", laughCount: 0 };

  const globalQuestions = conversations.reduce((acc, x) => acc + x.questionCount, 0);
  const globalQuestionPercent = grandTotalMessages > 0 ? ((globalQuestions / grandTotalMessages) * 100).toFixed(1) : "0";
  const topQuestionContact = [...conversations].sort((a, b) => b.questionCount - a.questionCount)[0] || { name: "N/A", questionCount: 0 };

  const globalEllipsis = conversations.reduce((acc, x) => acc + x.ellipsisCount, 0);
  const topEllipsisContact = [...conversations].sort((a, b) => b.ellipsisCount - a.ellipsisCount)[0] || { name: "N/A", ellipsisCount: 0 };

  const globalCaps = conversations.reduce((acc, x) => acc + x.capsCount, 0);
  const topCapsContact = [...conversations].sort((a, b) => b.capsCount - a.capsCount)[0] || { name: "N/A", capsCount: 0 };

  const globalDoubleTexts = conversations.reduce((acc, x) => acc + x.doubleTextCount, 0);
  const topDoubleTextContact = [...conversations].sort((a, b) => b.doubleTextCount - a.doubleTextCount)[0] || { name: "N/A", doubleTextCount: 0 };

  const globalMedia = conversations.reduce((acc, x) => acc + x.mediaCount, 0);

  // Day of week breakdown (Sunday Scaries / Peak Day)
  const dayNames = isVi
    ? ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const globalDaysOfWeek = [0, 0, 0, 0, 0, 0, 0];
  conversations.forEach(c => {
    (c.dayOfWeekCounts || []).forEach((cnt, idx) => {
      globalDaysOfWeek[idx] += cnt;
    });
  });
  let minDayIdx = 0;
  let maxDayIdx = 0;
  globalDaysOfWeek.forEach((cnt, idx) => {
    if (cnt < globalDaysOfWeek[minDayIdx]) minDayIdx = idx;
    if (cnt > globalDaysOfWeek[maxDayIdx]) maxDayIdx = idx;
  });
  const quietestDayName = dayNames[minDayIdx];
  const busiestDayName = dayNames[maxDayIdx];

  // Month breakdown (Seasonal Drift)
  const globalMonthCounts = {};
  conversations.forEach(c => {
    for (const [mKey, cnt] of Object.entries(c.monthCounts || {})) {
      globalMonthCounts[mKey] = (globalMonthCounts[mKey] || 0) + cnt;
    }
  });
  const sortedMonths = Object.entries(globalMonthCounts).sort((a, b) => b[1] - a[1]);
  const peakMonthStr = sortedMonths[0] ? `${sortedMonths[0][0]} (${sortedMonths[0][1].toLocaleString()} ${isVi ? 'tin' : 'msgs'})` : "N/A";
  const calmMonthStr = sortedMonths[sortedMonths.length - 1] ? `${sortedMonths[sortedMonths.length - 1][0]} (${sortedMonths[sortedMonths.length - 1][1].toLocaleString()} ${isVi ? 'tin' : 'msgs'})` : "N/A";

  // Essay pair & Vanishing point
  const topEssayPair = [...conversations].filter(x => x.totalMsgs >= 100).sort((a, b) => b.avgCombinedChars - a.avgCombinedChars)[0] || { name: "N/A", avgCombinedChars: 0 };
  const topVanishing = [...conversations].filter(x => x.totalMsgs >= 1000).sort((a, b) => b.daysSinceLastMsg - a.daysSinceLastMsg)[0] || { name: "N/A", totalMsgs: 0, daysSinceLastMsg: 0 };
  const tenKClubCount = conversations.filter(x => x.totalMsgs >= 10000).length;

  const caffeineCups = Math.max(1, Math.round(globalNightOwlMsgs / 40)).toLocaleString();
  const walkingKm = Math.round((grandTotalChars * 0.75) / 1000).toLocaleString();

  // Specific Conversational Quirks Computations (Moved to Key Insights)
  const validForNeg = conversations.filter(x => x.totalMsgs >= 200 && x.oppositeMsgs >= 50);
  const topSpamQuipContact = [...validForNeg].sort((a, b) => b.oppLowQualityPercent - a.oppLowQualityPercent)[0] || { name: "N/A", oppLowQualityPercent: 0, oppQualityPercent: 0 };
  const topOneWordContact = [...validForNeg].sort((a, b) => a.avgCharsOpp - b.avgCharsOpp)[0] || { name: "N/A", avgCharsOpp: 0, oppositeMsgs: 0 };
  const topCarrierContact = [...validForNeg].sort((a, b) => b.myShare - a.myShare)[0] || { name: "N/A", myShare: 0, myMsgs: 0, oppositeMsgs: 0 };
  const topSlowReplyContact = [...validForNeg].filter(x => x.avgReplySecs !== null && x.avgReplySecs > 0).sort((a, b) => b.avgReplySecs - a.avgReplySecs)[0] || { name: "N/A", avgReplyFormatted: "N/A" };
  const topGhostingHiatusContact = [...validForNeg].sort((a, b) => b.maxGhostingGapDays - a.maxGhostingGapDays)[0] || { name: "N/A", maxGhostingGapDays: 0 };
  const topCharSkewContact = [...validForNeg].sort((a, b) => b.charDiff - a.charDiff)[0] || { name: "N/A", charDiff: 0 };

  // Card renderer helper for Key Insights & Fun Facts
  const renderInsightCard = (tag, quote, footer) => `
    <div class="insight-card spoiled" onclick="revealCardSpoiler(this)">
      <div class="insight-card-header">
        <div class="insight-tag">${tag}</div>
        <button class="card-share-btn" onclick="saveCardAsImage(this, event)" title="${isVi ? 'Lưu ảnh thẻ này' : 'Save card as image'}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
      </div>
      <div class="insight-quote-container">
        <div class="insight-quote">${quote}</div>
        <div class="spoiler-badge" title="${isVi ? 'Bấm để mở khoá' : 'Click to unlock'}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </div>
      </div>
      <div class="insight-footer">${footer}</div>
      <div class="card-watermark">bit.ly/buddies-wrapped</div>
    </div>
  `;

  // Pre-render Category Grid Cards (SSR)
  let categoriesHtml = "";
  categories.forEach(cat => {
    let list = [...conversations];
    if (cat.filterFn) list = list.filter(cat.filterFn);
    list.sort(cat.sortFn);
    const topItems = list.slice(0, topN);

    let itemsHtml = "";
    topItems.forEach((item, idx) => {
      const rankNum = idx + 1;
      itemsHtml += `
        <div class="rank-item">
          <div class="rank-info">
            <span class="rank-badge rank-${rankNum}">#${rankNum}</span>
            <div>
              <div class="rank-name">${item.name}</div>
              <div class="rank-meta">${cat.metaFn(item)}</div>
            </div>
          </div>
          <div class="rank-val">${cat.valFn(item)}</div>
        </div>
      `;
    });

    categoriesHtml += `
      <div class="category-card" data-cat-id="${cat.id}">
        <div class="category-card-header">${cat.title}</div>
        <div class="category-items">${itemsHtml}</div>
      </div>
    `;
  });

  // Pre-render Opposite Table Rows (SSR)
  const sortedOpposite = [...conversations].sort((a, b) => b.oppositeMsgs - a.oppositeMsgs);
  const oppositeRowsHtml = sortedOpposite.map((item, idx) => `
    <tr>
      <td><strong>${idx + 1}</strong></td>
      <td><strong>${item.name}</strong></td>
      <td><strong>${item.oppositeMsgs.toLocaleString()}</strong></td>
      <td>${item.oppositeQuality.toLocaleString()}</td>
      <td><span class="pill">${item.oppQualityPercent.toFixed(1)}%</span></td>
      <td>${formatChars(item.oppositeChars)}</td>
      <td>${item.avgCharsOpp.toFixed(1)} ch</td>
      <td>${item.oppShare.toFixed(1)}%</td>
      <td><span class="pill">${item.avgReplyFormatted}</span></td>
      <td>${item.firstDate} → ${item.lastDate}</td>
    </tr>
  `).join("");



  // Pre-render Raw Chat Rows (SSR)
  const rawRowsHtml = [...conversations].sort((a, b) => b.totalMsgs - a.totalMsgs).map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>${item.name}</strong></td>
      <td><span class="pill" style="background: var(--primary-container); color: var(--on-primary-container); font-weight: 700;">${item.overallScore} pts</span></td>
      <td><strong>${item.totalMsgs.toLocaleString()}</strong></td>
      <td>${item.myMsgs.toLocaleString()} (${item.myShare.toFixed(0)}%)</td>
      <td>${item.oppositeMsgs.toLocaleString()} (${item.oppShare.toFixed(0)}%)</td>
      <td>${item.qualityPercent}%</td>
      <td>${item.maxStreak}d</td>
      <td>${item.avgReplyFormatted}</td>
      <td>${item.firstDate} → ${item.lastDate}</td>
    </tr>
  `).join("");

  const rawJson = JSON.stringify(conversations);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buddies Wrapped</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/anthropic-fonts@1.1.0/cdn/v1/css/all.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..800;1,6..72,400..800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-serif: 'Anthropic Serif', 'Newsreader', Georgia, Cambria, 'Times New Roman', serif;
      --font-sans: 'Anthropic Sans', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: 'Anthropic Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --font-family: var(--font-sans);
      --primary: #D97757;
      --primary-hover: #E68B6E;
      --primary-container: #3D221A;
      --on-primary-container: #FAECE7;
      --bg: #151515;
      --surface: #1E1E1D;
      --surface-elevated: #262625;
      --text: #FAF9F5;
      --text-muted: #B0AEA5;
      --text-subtle: #75736C;
      --border: #2C2C2A;
      --border-subtle: #242422;
      --badge-bg: #2B2A28;
      --badge-text: #E5E3DB;
      --card-shadow: none;
      --rank-1: #D97706;
      --rank-2: #94A3B8;
      --rank-3: #B45309;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-family);
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.55;
      padding: 32px 0 60px;
    }

    /* Container */
    .main-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* Timeline Graph Styling */
    .graph-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 20px;
      align-items: center;
    }
    .graph-control-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .graph-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
    }
    .graph-select {
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-family: inherit;
      outline: none;
      cursor: pointer;
    }
    .graph-select:focus {
      border-color: var(--primary);
    }
    .graph-wrapper {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      position: relative;
      height: 520px;
      width: 100%;
    }

    /* Header */
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .top-title {
      font-family: var(--font-serif);
      font-size: 2.4rem;
      font-weight: 500;
      letter-spacing: -0.02em;
      margin: 0;
      color: var(--text);
    }
    .top-meta {
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .top-subtitle {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
    }
    .top-date {
      font-size: 0.8rem;
      color: var(--text-subtle);
      font-weight: 500;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .kpi-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
    }
    .kpi-label {
      font-size: 0.78rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .kpi-value {
      font-family: var(--font-serif);
      font-size: 1.85rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .kpi-sub {
      font-size: 0.78rem;
      color: var(--text-subtle);
      margin-top: 4px;
    }

    /* Sticky Navigation Tabs */
    .tabs-bar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--bg);
      display: flex;
      gap: 28px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
      overflow-x: auto;
      padding: 12px 0 0;
    }
    .tab-btn {
      padding: 10px 2px;
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.92rem;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
      transition: color 0.15s ease, border-color 0.15s ease;
      margin-bottom: -1px;
    }
    .tab-btn:hover {
      color: var(--text);
      border-bottom-color: var(--text-subtle);
    }
    .tab-btn.active {
      color: var(--primary);
      border-bottom: 2px solid var(--primary);
      font-weight: 600;
      background: transparent;
    }

    /* Section Header */
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .section-title {
      font-family: var(--font-serif);
      font-size: 1.45rem;
      font-weight: 500;
      letter-spacing: -0.01em;
    }

    /* Switch toggle styling */
    .insights-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .switch-container {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      user-select: none;
      background: var(--surface);
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid var(--border);
      transition: border-color 0.15s ease;
    }
    .switch-container:hover {
      border-color: var(--primary);
    }
    .switch-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-muted);
    }
    .switch-container input {
      display: none;
    }
    .switch-slider {
      position: relative;
      width: 36px;
      height: 20px;
      background-color: var(--badge-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      transition: all 0.25s ease;
      display: inline-block;
    }
    .switch-slider:before {
      content: "";
      position: absolute;
      height: 14px;
      width: 14px;
      left: 2px;
      bottom: 2px;
      background-color: var(--text-muted);
      border-radius: 50%;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .switch-container input:checked + .switch-slider {
      background-color: var(--primary-container);
      border-color: var(--primary);
    }
    .switch-container input:checked + .switch-slider:before {
      transform: translateX(16px);
      background-color: var(--primary);
    }

    /* Segmented Control */
    .segmented-control {
      display: inline-flex;
      background: var(--badge-bg);
      padding: 3px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    .seg-btn {
      padding: 4px 12px;
      border-radius: 6px;
      border: none;
      background: transparent;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s ease;
    }
    .seg-btn.active {
      background: var(--surface-elevated);
      color: var(--text);
    }

    /* Insights Quotes Grid */
    .insights-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }
    .insight-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      position: relative;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }
    .insight-card:hover {
      border-color: var(--border-subtle);
    }
    .insight-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .insight-tag {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary);
    }
    .card-share-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 0;
      border-radius: 6px;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, color 0.15s ease, background 0.15s ease;
    }
    .insight-card:hover .card-share-btn {
      opacity: 1;
      pointer-events: auto;
    }
    .insight-card.spoiled .card-share-btn,
    .insight-card.spoiled:hover .card-share-btn {
      opacity: 0 !important;
      pointer-events: none !important;
      visibility: hidden !important;
    }
    .card-share-btn:hover {
      color: var(--primary);
      background: rgba(217, 119, 87, 0.12);
    }
    .author-link {
      color: var(--primary);
      text-decoration: none;
      border-bottom: 1px dashed rgba(217, 119, 87, 0.4);
      transition: all 0.15s ease;
    }
    .author-link:hover {
      border-bottom-color: var(--primary);
      opacity: 0.9;
    }

    /* Quote & Spoiler Mode */
    .insight-quote-container {
      position: relative;
      min-height: 60px;
    }
    .insight-quote {
      font-family: var(--font-serif);
      font-size: 1.22rem;
      font-weight: 400;
      line-height: 1.55;
      color: var(--text);
      transition: filter 0.3s ease, opacity 0.3s ease;
    }
    .insight-quote strong {
      color: var(--primary);
    }
    .insight-card.spoiled {
      cursor: pointer;
    }
    .insight-card.spoiled .insight-quote {
      filter: blur(9px);
      user-select: none;
      opacity: 0.35;
    }
    .insight-card.spoiled .insight-footer {
      filter: blur(6px);
      user-select: none;
      opacity: 0.35;
      transition: filter 0.3s ease, opacity 0.3s ease;
    }
    .insight-card.spoiled:hover .insight-quote {
      filter: blur(6px);
      opacity: 0.55;
    }
    .insight-card.spoiled:hover .insight-footer {
      filter: blur(4px);
      opacity: 0.55;
    }
    .spoiler-badge {
      display: none;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: transparent;
      border: none;
      color: var(--primary);
      padding: 0;
      pointer-events: none;
      box-shadow: none;
      opacity: 0.85;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .insight-card.spoiled .spoiler-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .insight-card.spoiled:hover .spoiler-badge {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.15);
    }

    .insight-footer {
      font-size: 0.8rem;
      color: var(--text-muted);
      border-top: 1px solid var(--border-subtle);
      padding-top: 10px;
    }
    .card-watermark {
      display: none;
      font-size: 0.72rem;
      color: var(--text-subtle);
      text-align: right;
      margin-top: -2px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    /* Tables (Plain layout) */
    .table-container {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--surface);
      margin-bottom: 28px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
      text-align: left;
    }
    th {
      background: var(--badge-bg);
      color: var(--text-muted);
      font-weight: 600;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-subtle);
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td {
      background: var(--primary-container);
      color: var(--on-primary-container);
    }

    /* Rank Badges & Pills */
    .rank-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 6px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 0.78rem;
      background: var(--badge-bg);
      color: var(--text-muted);
    }
    .rank-1 { color: #F59E0B; background: rgba(245, 158, 11, 0.15); font-weight: 800; }
    .rank-2 { color: #CBD5E1; background: rgba(203, 213, 225, 0.15); font-weight: 800; }
    .rank-3 { color: #F97316; background: rgba(249, 115, 22, 0.15); font-weight: 800; }

    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--badge-bg);
      color: var(--badge-text);
    }

    /* Categories Grid */
    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 20px;
    }
    .category-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
    }
    .category-card-header {
      font-family: var(--font-serif);
      font-weight: 600;
      font-size: 1.15rem;
      letter-spacing: -0.01em;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .rank-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      border-radius: 8px;
      margin-bottom: 4px;
      transition: background 0.15s ease;
    }
    .rank-item:hover {
      background: var(--badge-bg);
    }
    .rank-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .rank-name {
      font-weight: 600;
      font-size: 0.9rem;
    }
    .rank-meta {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .rank-val {
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--primary);
      text-align: right;
    }

    /* Search Box */
    .search-box {
      width: 100%;
      max-width: 300px;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface-elevated);
      color: var(--text);
      font-size: 0.85rem;
      font-family: inherit;
      outline: none;
    }
    .search-box:focus {
      border-color: var(--primary);
    }

    /* Tab Switcher */
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    @media (max-width: 768px) {
      .top-title { font-size: 1.6rem; }
      .categories-grid, .insights-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="main-container">
    <!-- Top Header -->
    <div class="top-header">
      <h1 class="top-title">${t.title}</h1>
      <div class="top-meta">
        <div class="top-subtitle">${t.subtitle}</div>
        <div class="top-date">${t.dateRange(startDateFormatted, endDateFormatted)}</div>
      </div>
    </div>

    <!-- KPI Grid -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">${t.kpiActiveTime}</div>
        <div class="kpi-value">${totalDurationText}</div>
        <div class="kpi-sub">${globalTotalDays.toLocaleString()} ${t.kpiTotalDays}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t.kpiTotalChats}</div>
        <div class="kpi-value">${conversations.length}</div>
        <div class="kpi-sub">${t.kpiParsedRanked}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t.kpiTotalMsgs}</div>
        <div class="kpi-value">${grandTotalMessages.toLocaleString()}</div>
        <div class="kpi-sub">${t.kpiSentRecv}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t.kpiTotalChars}</div>
        <div class="kpi-value">${(grandTotalChars / 1000000).toFixed(2)}M</div>
        <div class="kpi-sub">${grandTotalChars.toLocaleString()} ${t.kpiCharsTyped}</div>
      </div>
    </div>

    <!-- Sticky Tabs Bar -->
    <div class="tabs-bar">
      <button class="tab-btn active" onclick="switchTab(this, 'tab-insights')">${t.tabInsights}</button>
      <button class="tab-btn" onclick="switchTab(this, 'tab-all')">${t.tabAll}</button>
      <button class="tab-btn" onclick="switchTab(this, 'tab-graph')">${t.tabGraph}</button>
      <button class="tab-btn" onclick="switchTab(this, 'tab-opposite')">${t.tabOpposite}</button>
      <button class="tab-btn" onclick="switchTab(this, 'tab-raw')">${t.tabRaw}</button>
    </div>

    <!-- TAB 0: KEY INSIGHTS & FUN COMPARISONS -->
    <div id="tab-insights" class="tab-content active">
      <div class="section-header">
        <div class="section-title">${isVi ? 'Điểm Nhấn & Thống Kê Thú Vị' : 'Key Insights & Fun Facts'}</div>
        <div class="insights-controls">
          <label class="switch-container">
            <span class="switch-label">${isVi ? 'Chế độ Spoiler' : 'Spoiler Mode'}</span>
            <input type="checkbox" id="spoiler-toggle" checked onchange="toggleAllSpoilers(this.checked)">
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>

      <div class="insights-grid">
        ${renderInsightCard(
          isVi ? 'Đại Thi Hào Bất Đắc Dĩ' : 'The Accidental Novelist',
          isVi
            ? `Dung lượng trò chuyện <strong>${(grandTotalChars / 1000000).toFixed(2)}M ký tự</strong> (~${grandTotalWords.toLocaleString()} từ) tương đương việc bạn đã viết <strong>${hpTimes}x toàn bộ 7 tập Harry Potter</strong> hoặc <strong>${wpTimes}x Chiến Tranh & Hòa Bình</strong>!`
            : `Your chat volume of <strong>${(grandTotalChars / 1000000).toFixed(2)}M characters</strong> (~${grandTotalWords.toLocaleString()} words) is equivalent to writing <strong>${hpTimes}x the entire Harry Potter 7-book series</strong> or <strong>${wpTimes}x War & Peace</strong>!`,
          isVi ? 'Quy chuẩn: Trọn bộ Harry Potter (6.1M ký tự), Chiến Tranh & Hòa Bình (3.1M ký tự)' : 'Benchmark: Harry Potter series (6.1M chars), War & Peace (3.1M chars)'
        )}

        ${renderInsightCard(
          isVi ? 'Khung Giờ Ma Thuật' : 'The Witching Hour',
          isVi
            ? `<strong>${globalWitchingPercent}%</strong> tổng tin nhắn (<strong>${globalWitchingMsgs.toLocaleString()} tin</strong>) rơi vào khung giờ khuya khoắt 2:00 – 4:00 sáng. Người bạn song sinh thức đêm cùng bạn là <strong>${topWitchingContact.name}</strong> (<strong>${topWitchingContact.witchingHourMsgs.toLocaleString()} tin lúc 2h–4h</strong>).`
            : `<strong>${globalWitchingPercent}%</strong> of all messages (<strong>${globalWitchingMsgs.toLocaleString()} msgs</strong>) landed in the dead of night between 2:00 AM and 4:00 AM. Your true insomniac twin is <strong>${topWitchingContact.name}</strong> (<strong>${topWitchingContact.witchingHourMsgs.toLocaleString()} witching-hour msgs</strong>).`,
          isVi ? 'Lọc chính xác trong khung giờ 02:00 AM đến 03:59 AM' : 'Filtered strictly between 02:00 AM and 03:59 AM'
        )}

        ${renderInsightCard(
          isVi ? 'Cặp Đôi Diễn Hài' : 'The Comedy Duo',
          isVi
            ? `Bạn đã chia sẻ <strong>${globalLaughMsgs.toLocaleString()} tiếng cười</strong> khắp các cuộc trò chuyện (<strong>${globalLaughPercent}%</strong> tin nhắn chứa "haha", "lol", hay "😂"). Bạn diễn hài ăn ý nhất của bạn là <strong>${topLaughContact.name}</strong> với <strong>${topLaughContact.laughCount.toLocaleString()} lượt cùng cười</strong>!`
            : `You shared <strong>${globalLaughMsgs.toLocaleString()} laughs</strong> across all chats (<strong>${globalLaughPercent}%</strong> of all messages contain "haha", "lol", or "😂"). Your comedy partner is <strong>${topLaughContact.name}</strong> with <strong>${topLaughContact.laughCount.toLocaleString()} laugh exchanges</strong>!`,
          isVi ? 'Bộ lọc nhận diện tiếng cười NLP (haha, hihi, lol, lmao, 😂, 🤣)' : 'NLP keyword detector (haha, hihi, lol, lmao, 😂, 🤣)'
        )}

        ${renderInsightCard(
          isVi ? 'Tâm Hồn Tò Mò' : 'The Curious Soul',
          isVi
            ? `<strong>${globalQuestionPercent}%</strong> tổng tin nhắn (<strong>${globalQuestions.toLocaleString()} câu hỏi</strong>) kết thúc bằng dấu "?". Người hay hỏi han bạn nhiều nhất là <strong>${topQuestionContact.name}</strong> với <strong>${topQuestionContact.questionCount.toLocaleString()} câu hỏi</strong>.`
            : `<strong>${globalQuestionPercent}%</strong> of all messages (<strong>${globalQuestions.toLocaleString()} questions</strong>) ended with a "?". Your most inquisitive partner is <strong>${topQuestionContact.name}</strong> with <strong>${topQuestionContact.questionCount.toLocaleString()} questions asked</strong>.`,
          isVi ? 'Nhận diện dấu hỏi chấm trong toàn bộ tin nhắn' : 'Question mark detection across all exchanges'
        )}

        ${renderInsightCard(
          isVi ? 'Nghiện Dấu Ba Chấm' : 'The Ellipsis Addict',
          isVi
            ? `Có <strong>${globalEllipsis.toLocaleString()} tin nhắn</strong> chứa dấu ba chấm "...". Bậc thầy của sự ngập ngừng và lấp lửng là <strong>${topEllipsisContact.name}</strong> với <strong>${topEllipsisContact.ellipsisCount.toLocaleString()} tin nhắn</strong>.`
            : `A total of <strong>${globalEllipsis.toLocaleString()} messages</strong> contained trailing "..." ellipsis. The master of suspense and hesitation is <strong>${topEllipsisContact.name}</strong> with <strong>${topEllipsisContact.ellipsisCount.toLocaleString()} ellipsis messages</strong>.`,
          isVi ? 'Nhận diện thói quen ngập ngừng, lấp lửng và dừng lại suy nghĩ' : 'Trailing off, pausing, and hesitation pattern detection'
        )}

        ${renderInsightCard(
          isVi ? 'Cơn Lốc VIẾT HOA' : 'ALL CAPS Drama',
          isVi
            ? `<strong>${globalCaps.toLocaleString()} tin nhắn</strong> được bắn ra ở chế độ VIẾT HOA HẾT CỠ! Người kích hoạt cảm xúc hào hứng đó nhiều nhất là <strong>${topCapsContact.name}</strong> (<strong>${topCapsContact.capsCount.toLocaleString()} tin viết hoa</strong>).`
            : `<strong>${globalCaps.toLocaleString()} messages</strong> were fired in ALL CAPS shouting mode! The person who triggered the most uppercase excitement was <strong>${topCapsContact.name}</strong> (<strong>${topCapsContact.capsCount.toLocaleString()} shouting msgs</strong>).`,
          isVi ? 'Tin nhắn viết hoa toàn bộ từ 6 ký tự trở lên' : 'Uppercase messages with 6+ characters'
        )}

        ${renderInsightCard(
          isVi ? 'Nhịp Điệu Trong Tuần' : 'The Weekly Rhythm',
          isVi
            ? `Năng lượng trò chuyện của bạn bùng nổ nhất vào các ngày <strong>${busiestDayName}</strong> và hạ xuống mức thấp nhất vào các ngày <strong>${quietestDayName}</strong> trong suốt năm!`
            : `Your conversational energy peaks on <strong>${busiestDayName}s</strong> and drops to its quietest low on <strong>${quietestDayName}s</strong> across the entire year!`,
          isVi ? 'Phân phối khối lượng tin nhắn theo từng thứ trong tuần' : 'Aggregated day-of-week message volume distribution'
        )}

        ${renderInsightCard(
          isVi ? 'Mùa Nhớ Nhau Nhất' : 'Seasonal Drift',
          isVi
            ? `Mùa nhắn tin bận rộn nhất mọi thời đại của bạn là <strong>${peakMonthStr}</strong>, trong khi tháng êm đềm, thanh bình nhất là <strong>${calmMonthStr}</strong>.`
            : `Your all-time busiest chatting season was <strong>${peakMonthStr}</strong>, while your most tranquil, quiet month was <strong>${calmMonthStr}</strong>.`,
          isVi ? 'Sự dịch chuyển khối lượng tương tác theo từng tháng' : 'Monthly aggregated communication volume shifts'
        )}

        ${renderInsightCard(
          isVi ? 'Tâm Sự Trùng Điệp' : 'The Essay Exchange',
          isVi
            ? `Những cuộc thảo luận có chiều sâu nhất của bạn là với <strong>${topEssayPair.name}</strong>, đạt trung bình <strong>${topEssayPair.avgCombinedChars.toFixed(1)} ký tự mỗi tin nhắn</strong> từ cả 2 phía!`
            : `Your deepest long-form discussions were with <strong>${topEssayPair.name}</strong>, averaging <strong>${topEssayPair.avgCombinedChars.toFixed(1)} characters per message</strong> across both sides!`,
          isVi ? 'Độ dài tin nhắn trung bình kết hợp cao nhất (trên 100+ tin)' : 'Highest combined average message length (100+ msgs)'
        )}

        ${renderInsightCard(
          isVi ? 'Kỷ Niệm Ngủ Yên' : 'The Dormant Giant',
          isVi
            ? `Cuộc trò chuyện với <strong>${topVanishing.name}</strong> từng có tới <strong>${topVanishing.totalMsgs.toLocaleString()} tin nhắn</strong>, nhưng đã lặng lẽ yên ắng suốt <strong>${topVanishing.daysSinceLastMsg} ngày qua</strong>.`
            : `Your chat with <strong>${topVanishing.name}</strong> boasts a staggering <strong>${topVanishing.totalMsgs.toLocaleString()} messages</strong>, but has been peacefully silent for <strong>${topVanishing.daysSinceLastMsg} days</strong>.`,
          isVi ? 'Cuộc trò chuyện dung lượng lớn nhất ngủ yên >90 ngày' : 'Highest-volume historic chat dormant for >90 days'
        )}

        ${renderInsightCard(
          isVi ? 'Hội Bạn Tri Kỷ 10K+' : 'The 10K+ VIP Club',
          isVi
            ? `Chỉ có <strong>${tenKClubCount} cuộc trò chuyện ưu tú</strong> trong tổng số ${conversations.length} chạm đến cột mốc huyền thoại <strong>10.000+ tin nhắn</strong>!`
            : `Only <strong>${tenKClubCount} elite conversations</strong> out of ${conversations.length} crossed the legendary milestone of <strong>10,000+ total messages</strong>!`,
          isVi ? 'Nhóm bạn bè thân thiết có dung lượng tin nhắn khủng nhất' : 'Top-tier high volume inner circle'
        )}

        ${renderInsightCard(
          isVi ? 'Nhiên Liệu Cà Phê' : 'Caffeine Fuel',
          isVi
            ? `Bạn đã trao đổi <strong>${globalNightOwlMsgs.toLocaleString()} tin nhắn nửa đêm</strong> — tương đương việc uống khoảng <strong>${caffeineCups} cốc cà phê espresso</strong> để duy trì năng lượng thức khuya!`
            : `You exchanged <strong>${globalNightOwlMsgs.toLocaleString()} midnight messages</strong> — roughly equivalent to drinking <strong>${caffeineCups} cups of espresso</strong> to fuel those late-night conversations!`,
          isVi ? 'Quy đổi độ bền thức khuya (~40 tin nhắn đêm = 1 cốc cà phê)' : 'Late-night stamina conversion (~40 msgs per cup of coffee)'
        )}

        ${renderInsightCard(
          isVi ? 'Xuyên Việt Bằng Ngón Tay' : 'Walking Distance',
          isVi
            ? `Nếu mỗi ký tự gõ phím là một bước chân, hành trình nhắn tin của bạn tương đương <strong>${walkingKm} kilomet</strong> — một chuyến đi bộ xuyên từ Hà Nội vào tận TP. Hồ Chí Minh!`
            : `If every character typed was a physical step taken, your texting journey would span <strong>${walkingKm} kilometers</strong> — a walking trek from Hanoi down to Ho Chi Minh City and beyond!`,
          isVi ? 'Ước tính 1 ký tự = 1 bước chân người (~0.75 mét)' : 'Estimated at 1 character = 1 human step (~0.75 meters)'
        )}

        ${renderInsightCard(
          isVi ? 'Pho Tiểu Thuyết Bách Khoa' : 'The Paperback Library',
          isVi
            ? `Nếu được in thành sách tiểu thuyết chuẩn, tin nhắn của bạn sẽ dày khoảng <strong>${paperbackPages.toLocaleString()} trang</strong> — tương đương một bộ bách khoa toàn thư <strong>${bookVolumes} tập</strong>.`
            : `If printed in standard novel format, your messages would fill approximately <strong>${paperbackPages.toLocaleString()} pages</strong> — a massive <strong>${bookVolumes}-volume encyclopedia set</strong>.`,
          isVi ? 'Ước tính tiêu chuẩn ~2.500 ký tự mỗi trang sách in' : 'Assuming standard novel formatting of ~2,500 characters per page'
        )}

        ${renderInsightCard(
          isVi ? 'Marathon Gõ Phím' : 'Typing Marathon',
          isVi
            ? `Với tốc độ gõ trò chuyện 40 từ/phút, bạn và bạn bè đã dành khoảng <strong>${typingHours.toLocaleString()} giờ</strong> (<strong>${typingDays} ngày liên tục</strong>) chỉ để gõ phím.`
            : `At a conversational typing pace of 40 words per minute, you and your buddies have spent roughly <strong>${typingHours.toLocaleString()} hours</strong> (<strong>${typingDays} straight days</strong>) of non-stop typing.`,
          isVi ? 'Dựa trên tốc độ gõ liên tục trung bình 200 ký tự / phút' : 'Based on average continuous typing speed of 200 characters / min'
        )}

        ${renderInsightCard(
          isVi ? 'Ruy Băng Ký Tự' : 'End-to-End Ribbon',
          isVi
            ? `Nếu trải dài toàn bộ dòng chữ trên một hàng in kích cỡ 12pt, đoạn tin nhắn của bạn sẽ dài <strong>${totalTextKm} kilomet</strong> (<strong>${totalTextMiles} dặm</strong>)!`
            : `If laid out in a single continuous line of standard 12pt printed text, your conversation history would stretch <strong>${totalTextKm} kilometers</strong> (<strong>${totalTextMiles} miles</strong>) long!`,
          isVi ? 'Dựa trên chiều rộng ký tự in tiêu chuẩn (~2.1mm mỗi chữ cái)' : 'Based on physical typography character width (~2.1mm per letter)'
        )}

        ${renderInsightCard(
          isVi ? 'Hố Đen Trọng Lực' : 'Gravitational Center',
          isVi
            ? `Cuộc trò chuyện với riêng <strong>${top1VolumeContact.name}</strong> đã chiếm tới <strong>${top1VolumePercent}%</strong> toàn bộ lịch sử tin nhắn của bạn (<strong>${top1VolumeContact.totalMsgs.toLocaleString()} tin nhắn</strong>).`
            : `Your connection with <strong>${top1VolumeContact.name}</strong> alone accounts for <strong>${top1VolumePercent}%</strong> of your entire message history (<strong>${top1VolumeContact.totalMsgs.toLocaleString()} messages</strong>).`,
          isVi ? 'Tâm điểm kết nối dày đặc nhất trong vòng kết nối của bạn' : 'Your #1 most dense communication nexus'
        )}

        ${renderInsightCard(
          isVi ? 'Tay Đua Phản Xạ F1' : 'Formula 1 Reflexes',
          isVi
            ? `Người phản hồi tin nhắn nhanh nhất là <strong>${topFastestContact.name}</strong>, trả lời lại bạn với thời gian trung bình chỉ <strong>${topFastestContact.avgReplyFormatted}</strong>!`
            : `Your fastest conversational responder is <strong>${topFastestContact.name}</strong>, replying back in an average of just <strong>${topFastestContact.avgReplyFormatted}</strong>!`,
          isVi ? 'Tính từ khoảng cách thời gian Họ → Tôi phản hồi trong vòng 24 giờ' : 'Calculated from verified Them → Me reply deltas within 24h'
        )}

        ${renderInsightCard(
          isVi ? 'Khoảng Lặng Đại Học' : 'The 4-Year Hiatus',
          isVi
            ? `Khoảng lặng im ắng dài nhất giữa bạn và <strong>${topGhostContact.name}</strong> kéo dài <strong>${topGhostContact.maxGhostingGapDays.toLocaleString()} ngày</strong> (~${(topGhostContact.maxGhostingGapDays / 365).toFixed(1)} năm) — đủ thời gian để học xong một chương trình đại học!`
            : `The longest ghosting gap between you and <strong>${topGhostContact.name}</strong> lasted <strong>${topGhostContact.maxGhostingGapDays.toLocaleString()} days</strong> (~${(topGhostContact.maxGhostingGapDays / 365).toFixed(1)} years) — enough time to enroll and graduate college!`,
          isVi ? 'Khoảng thời gian im lặng dài nhất giữa 2 lần tương tác liên tiếp' : 'Maximum silence between two consecutive interactions'
        )}

        ${renderInsightCard(
          isVi ? 'Hội Cú Đêm' : 'Night Owl Society',
          isVi
            ? `<strong>${globalNightOwlPercent}%</strong> tổng tin nhắn (<strong>${globalNightOwlMsgs.toLocaleString()} tin</strong>) được gửi vào đêm muộn (23h – 4h). Người bạn nửa đêm của bạn là <strong>${topNightOwlContact.name}</strong> với <strong>${topNightOwlContact.nightOwlMsgs.toLocaleString()} tin</strong>.`
            : `<strong>${globalNightOwlPercent}%</strong> of all messages (<strong>${globalNightOwlMsgs.toLocaleString()} msgs</strong>) were sent late at night (11 PM – 4 AM). Your midnight partner is <strong>${topNightOwlContact.name}</strong> with <strong>${topNightOwlContact.nightOwlMsgs.toLocaleString()} messages</strong>.`,
          isVi ? 'Lọc trên toàn bộ các mốc thời gian đêm khuya' : 'Filtered across all late-night timestamp distributions'
        )}

        ${renderInsightCard(
          isVi ? 'Tiếng Chim Hót Đầu Ngày' : 'Early Bird Connection',
          isVi
            ? `Quán quân dậy sớm của bạn là <strong>${topEarlyBirdContact.name}</strong>, cùng bạn trao đổi <strong>${topEarlyBirdContact.earlyBirdMsgs.toLocaleString()} tin nhắn</strong> vào lúc bình minh (5h – 9h sáng).`
            : `Your morning champion is <strong>${topEarlyBirdContact.name}</strong>, exchanging <strong>${topEarlyBirdContact.earlyBirdMsgs.toLocaleString()} messages</strong> at dawn (5 AM – 9 AM) before most people start their day.`,
          isVi ? 'Các cuộc trò chuyện sáng sớm từ 5:00 AM đến 9:00 AM' : 'Morning conversations between 5:00 AM and 9:00 AM'
        )}

        ${renderInsightCard(
          isVi ? 'Trốn Chạy Cuối Tuần' : 'Weekend Escape',
          isVi
            ? `Cuối tuần chiếm <strong>${globalWeekendPercent}%</strong> đời sống giao tiếp của bạn (<strong>${globalWeekendMsgs.toLocaleString()} tin</strong>). Đồng minh cuối tuần số 1 là <strong>${topWeekendContact.name}</strong> (<strong>${topWeekendContact.weekendMsgs.toLocaleString()} tin nhắn</strong>).`
            : `Weekends account for <strong>${globalWeekendPercent}%</strong> of your social life (<strong>${globalWeekendMsgs.toLocaleString()} msgs</strong>). Your top weekend conspirator is <strong>${topWeekendContact.name}</strong> (<strong>${topWeekendContact.weekendMsgs.toLocaleString()} weekend msgs</strong>).`,
          isVi ? 'Phân bổ tin nhắn vào Thứ Bảy và Chủ Nhật' : 'Saturday and Sunday chat distributions'
        )}

        ${renderInsightCard(
          isVi ? 'Bậc Thầy Độc Thoại' : 'The Monologue Master',
          isVi
            ? `Tin nhắn đơn lẻ không đứt đoạn dài nhất lịch sử thuộc về bạn và <strong>${topMonologueContact.name}</strong> với <strong>${topMonologueContact.longestMsgChars.toLocaleString()} ký tự</strong> — một áng văn chương thực thụ!`
            : `The single longest uninterrupted message in your history was <strong>${topMonologueContact.longestMsgChars.toLocaleString()} characters</strong> long in your chat with <strong>${topMonologueContact.name}</strong> — a full-blown literary essay!`,
          isVi ? 'Một dòng tin nhắn đơn dài nhất không ngắt dòng' : 'Longest single text entry without splitting lines'
        )}

        ${renderInsightCard(
          isVi ? 'Cân Bằng Hoàn Hảo' : 'Harmonious Equilibrium',
          isVi
            ? `Mối quan hệ cân bằng nhất của bạn là với <strong>${topBalanceContact.name}</strong> (${topBalanceContact.myShare.toFixed(1)}% vs ${topBalanceContact.oppShare.toFixed(1)}% qua <strong>${topBalanceContact.totalMsgs.toLocaleString()} tin nhắn</strong>) — một sự đồng điệu đôi bên đích thực.`
            : `Your most equally balanced connection is with <strong>${topBalanceContact.name}</strong> (${topBalanceContact.myShare.toFixed(1)}% vs ${topBalanceContact.oppShare.toFixed(1)}% across <strong>${topBalanceContact.totalMsgs.toLocaleString()} messages</strong>) — a true 50/50 reciprocal partnership.`,
          isVi ? 'Tỷ lệ cho và nhận cân bằng hai chiều giữa đôi bên' : 'Mutual give-and-take conversation balance'
        )}

        ${renderInsightCard(
          isVi ? 'Cơn Mưa Tin Nhắn' : 'Rapid-Fire Barrage',
          isVi
            ? `Kỷ lục chuỗi tin nhắn liên thanh liên tiếp thuộc về <strong>${topBurstContact.name}</strong> với <strong>${topBurstContact.maxBurstCount} tin nhắn liên tiếp</strong> được gửi đi một mạch không ngắt quãng!`
            : `The record for the longest rapid-fire burst belongs to <strong>${topBurstContact.name}</strong> with <strong>${topBurstContact.maxBurstCount} consecutive messages</strong> fired off in a single unbroken stream!`,
          isVi ? 'Số tin nhắn liên tiếp tối đa mà không cần đợi đối phương hồi đáp' : 'Maximum consecutive messages without a reply from the other person'
        )}

        ${renderInsightCard(
          isVi ? 'Sợi Dây Bất Tận' : 'The Unbroken Connection',
          isVi
            ? `Chuỗi ngày nhắn tin liên tục dài nhất của bạn là với <strong>${topStreakContact.name}</strong>, trò chuyện suốt <strong>${topStreakContact.maxStreak} ngày liên tiếp</strong> không bỏ lỡ một ngày nào.`
            : `Your longest daily streak was with <strong>${topStreakContact.name}</strong>, chatting for <strong>${topStreakContact.maxStreak} consecutive days</strong> without missing a single 24-hour cycle.`,
          isVi ? 'Chuỗi ngày nhắn tin liên tục qua từng ngày dài nhất' : 'Longest unbroken day-by-day messaging streak'
        )}

        ${renderInsightCard(
          isVi ? 'Siêu Tân Tinh Bùng Nổ' : 'Peak Day Supernova',
          isVi
            ? `Vào ngày trò chuyện bùng nổ kỷ lục nhất (<strong>${topPeakContact.peakDayDate}</strong>), bạn và <strong>${topPeakContact.name}</strong> đã trao đổi tới <strong>${topPeakContact.peakDayCount.toLocaleString()} tin nhắn trong 24 giờ</strong>!`
            : `On your most explosive chat day on record (<strong>${topPeakContact.peakDayDate}</strong>), you and <strong>${topPeakContact.name}</strong> traded a blistering <strong>${topPeakContact.peakDayCount.toLocaleString()} messages in 24 hours</strong>!`,
          isVi ? 'Kỷ lục dung lượng tin nhắn trong một ngày dương lịch duy nhất' : 'All-time record volume within a single calendar day'
        )}

        ${renderInsightCard(
          isVi ? 'Tín Hiệu Tâm Tình' : 'Signal to Noise',
          isVi
            ? `<strong>${globalQualityPercent}%</strong> kho lưu trữ tin nhắn của bạn là những câu có chiều sâu, ngữ nghĩa trọn vẹn, còn <strong>${100 - globalQualityPercent}%</strong> là phản ứng nhanh, câu cụt hoặc biểu tượng cảm xúc.`
            : `<strong>${globalQualityPercent}%</strong> of your entire chat archive consists of meaningful, substantive sentences, while <strong>${100 - globalQualityPercent}%</strong> are rapid reactions, short quips, or emojis.`,
          isVi ? 'Đánh giá theo thuật toán chất lượng NLP (độ dài và cấu trúc câu)' : 'Evaluated using NLP quality heuristic (sentence length & substance)'
        )}

        ${renderInsightCard(
          isVi ? 'Bậc Thầy Kiệm Lời' : 'The One-Word Wonder',
          isVi
            ? `Người giao tiếp ngắn gọn nhất của bạn là <strong>${topOneWordContact.name}</strong>, chỉ đạt trung bình <strong>${topOneWordContact.avgCharsOpp.toFixed(1)} ký tự/tin</strong> qua ${topOneWordContact.oppositeMsgs.toLocaleString()} tin nhắn — bậc thầy kiệm lời!`
            : `Your most concise conversationalist is <strong>${topOneWordContact.name}</strong>, averaging just <strong>${topOneWordContact.avgCharsOpp.toFixed(1)} characters per message</strong> across ${topOneWordContact.oppositeMsgs.toLocaleString()} messages — the true master of brevity!`,
          isVi ? 'Người có độ dài ký tự trung bình trên mỗi tin nhắn thấp nhất (200+ tin)' : 'Contact with the lowest average character length per message (200+ msgs)'
        )}

        ${renderInsightCard(
          isVi ? 'Chúa Tể Thả Icon' : 'The Reaction Specialist',
          isVi
            ? `<strong>${topSpamQuipContact.oppLowQualityPercent.toFixed(1)}%</strong> tin nhắn từ <strong>${topSpamQuipContact.name}</strong> là những câu cảm thán ngắn, icon hoặc phản ứng chớp nhoáng.`
            : `<strong>${topSpamQuipContact.oppLowQualityPercent.toFixed(1)}%</strong> of messages from <strong>${topSpamQuipContact.name}</strong> were short punchy quips, standalone emojis, or rapid reactions.`,
          isVi ? 'Tỷ lệ tin nhắn ngắn và phản ứng nhanh cao nhất (200+ tin)' : 'Highest percentage of rapid reactions and short texts (200+ msgs)'
        )}

        ${renderInsightCard(
          isVi ? 'Chiếc Lưng Còng Gánh Team' : 'The Conversation Carrier',
          isVi
            ? `Trong cuộc trò chuyện với <strong>${topCarrierContact.name}</strong>, bạn đã hăng hái dẫn dắt mạch truyện khi gửi tới <strong>${topCarrierContact.myShare.toFixed(1)}% tổng số tin nhắn</strong> (${topCarrierContact.myMsgs.toLocaleString()} tin do bạn gửi vs ${topCarrierContact.oppositeMsgs.toLocaleString()} tin do họ gửi).`
            : `In your chat with <strong>${topCarrierContact.name}</strong>, you enthusiastically drove the momentum by sending <strong>${topCarrierContact.myShare.toFixed(1)}% of all messages</strong> (${topCarrierContact.myMsgs.toLocaleString()} sent by you vs ${topCarrierContact.oppositeMsgs.toLocaleString()} by them).`,
          isVi ? 'Cuộc trò chuyện bạn gánh vác tỷ trọng số lượng tin nhắn cao nhất' : 'Chat where you carried the largest percentage of messaging volume'
        )}

        ${renderInsightCard(
          isVi ? 'Bậc Thầy Điềm Tĩnh' : 'The Patient Zen Master',
          isVi
            ? `<strong>${topSlowReplyContact.name}</strong> là người có nhịp trả lời thong thả, từ tốn nhất, với độ trễ phản hồi trung bình <strong>${topSlowReplyContact.avgReplyFormatted}</strong>.`
            : `<strong>${topSlowReplyContact.name}</strong> took the most thoughtful, relaxed time to reply back, with an average response delay of <strong>${topSlowReplyContact.avgReplyFormatted}</strong>.`,
          isVi ? 'Thời gian phản hồi Họ → Tôi trung bình dài nhất trong khung 24h' : 'Longest average Them → Me reply time within 24h window'
        )}

        ${renderInsightCard(
          isVi ? 'Bất Đối Xứng Ngôn Từ' : 'The Great Volume Skew',
          isVi
            ? `Bạn đã viết nhiều hơn <strong>+${formatChars(topCharSkewContact.charDiff)} ký tự</strong> so với <strong>${topCharSkewContact.name}</strong> — một sự chênh lệch lớn khi những bài luận văn dài của bạn gánh trọn vẹn kho lưu trữ!`
            : `You wrote <strong>+${formatChars(topCharSkewContact.charDiff)} characters more</strong> than <strong>${topCharSkewContact.name}</strong> — a massive volume skew where your typed essays heavily carried the archive!`,
          isVi ? 'Chênh lệch lượng ký tự thuần nghiêng hẳn về phía bạn' : 'Net character count difference heavily skewed on your side'
        )}
      </div>
    </div>

    <!-- TAB 1: ALL CATEGORIES GRID (PRE-RENDERED IN HTML) -->
    <div id="tab-all" class="tab-content">
      <div class="section-header">
        <div class="section-title">${t.catRankings}</div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">${t.display}</span>
          <div class="segmented-control">
            <button class="seg-btn ${topN === 3 ? 'active' : ''}" onclick="setTopN(this, 3)">Top 3</button>
            <button class="seg-btn ${topN === 5 ? 'active' : ''}" onclick="setTopN(this, 5)">Top 5</button>
            <button class="seg-btn ${topN === 10 ? 'active' : ''}" onclick="setTopN(this, 10)">Top 10</button>
            <button class="seg-btn ${topN >= conversations.length ? 'active' : ''}" onclick="setTopN(this, 999)">All</button>
          </div>
        </div>
      </div>

      <div class="categories-grid" id="categories-container">
        ${categoriesHtml}
      </div>
    </div>

    <!-- TAB 2: TIMELINE GRAPHS (PLACED RIGHT OF LEADERBOARD & CATEGORIES) -->
    <div id="tab-graph" class="tab-content">
      <div class="section-header">
        <div>
          <div class="section-title">${t.graphTitle}</div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
            ${t.graphDesc}
          </p>
        </div>
      </div>

      <div class="graph-controls">
        <div class="graph-control-group">
          <label class="graph-label" for="graph-metric">${t.graphMetric}</label>
          <select id="graph-metric" class="graph-select" onchange="renderActivityChart()">
            <option value="all">${t.metricAll}</option>
            <option value="growth">${t.metricGrowth}</option>
            <option value="opp">${t.metricOpp}</option>
            <option value="my">${t.metricMy}</option>
            <option value="night">${t.metricNight}</option>
            <option value="quality">${t.metricQuality}</option>
            <option value="chars">${t.metricChars}</option>
          </select>
        </div>

        <div class="graph-control-group">
          <label class="graph-label" for="graph-topn">${t.graphShowLines}</label>
          <select id="graph-topn" class="graph-select" onchange="renderActivityChart()">
            <option value="5">${t.top5}</option>
            <option value="10" selected>${t.top10}</option>
            <option value="15">${t.top15}</option>
            <option value="20">${t.top20}</option>
            <option value="999">${t.topAll}</option>
          </select>
        </div>

        <div class="graph-control-group">
          <label class="graph-label" for="graph-group">${t.graphAggregation}</label>
          <select id="graph-group" class="graph-select" onchange="renderActivityChart()">
            <option value="weekly" selected>${t.aggWeekly}</option>
            <option value="monthly">${t.aggMonthly}</option>
            <option value="daily">${t.aggDaily}</option>
          </select>
        </div>
      </div>

      <div class="graph-wrapper">
        <canvas id="activityChart"></canvas>
      </div>
    </div>

    <!-- TAB 3: DATA FROM THEM ONLY (PLAIN LAYOUT) -->
    <div id="tab-opposite" class="tab-content">
      <div class="section-header">
        <div>
          <div class="section-title">${t.oppTitle}</div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
            ${t.oppDesc}
          </p>
        </div>
        <input type="text" class="search-box" id="search-opposite" placeholder="${t.searchContacts}" onkeyup="filterTable('table-opposite', this.value)">
      </div>

      <div class="table-container">
        <table id="table-opposite">
          <thead>
            <tr>
              <th>${t.thRank}</th>
              <th>${t.thContactThem}</th>
              <th>${t.thMsgsSent}</th>
              <th>${t.thQualMsgs}</th>
              <th>${t.thQualRate}</th>
              <th>${t.thCharsWritten}</th>
              <th>${t.thAvgChars}</th>
              <th>${t.thTheirShare}</th>
              <th>${t.thReplySpeed}</th>
              <th>${t.thTimeRange}</th>
            </tr>
          </thead>
          <tbody id="tbody-opposite">
            ${oppositeRowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: RAW CHAT LIST (PLAIN LAYOUT) -->
    <div id="tab-raw" class="tab-content">
      <div class="section-header">
        <div class="section-title">${t.allTitle(conversations.length)}</div>
        <input type="text" class="search-box" id="search-raw" placeholder="${t.filterChats}" onkeyup="filterTable('table-raw', this.value)">
      </div>

      <div class="table-container">
        <table id="table-raw">
          <thead>
            <tr>
              <th>${t.thRank}</th>
              <th>${t.thContactName}</th>
              <th>${t.thValueScore}</th>
              <th>${t.thTotalMsgs}</th>
              <th>${t.thYouSent}</th>
              <th>${t.thTheySent}</th>
              <th>${t.thQualRate}</th>
              <th>${t.thStreak}</th>
              <th>${t.thReplySpeed}</th>
              <th>${t.thTimeRange}</th>
            </tr>
          </thead>
          <tbody id="tbody-raw">
            ${rawRowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    const data = ${rawJson};
    let currentTopN = ${topN};

    let chartInstance = null;
    const PALETTE = [
      '#D97757', '#38BDF8', '#34D399', '#A78BFA', '#FBBF24',
      '#F472B6', '#60A5FA', '#A3E635', '#FB923C', '#2DD4BF',
      '#818CF8', '#FB7185', '#4ADE80', '#E879F9', '#38C172',
      '#93C5FD', '#FCD34D', '#C084FC', '#F87171', '#6EE7B7'
    ];

    function switchTab(btn, tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      if (btn) btn.classList.add('active');
      const target = document.getElementById(tabId);
      if (target) target.classList.add('active');
      if (tabId === 'tab-graph') {
        setTimeout(renderActivityChart, 50);
      }
    }

    function setTopN(btn, n) {
      currentTopN = n;
      document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      renderCategoriesDynamic();
    }

    function formatNumber(num) {
      return (num || 0).toLocaleString();
    }

    function formatChars(num) {
      if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return String(num);
    }

    const isVi = ${isVi};
    const dynamicCategories = [
      {
        title: isVi ? "Điểm Giá Trị Tổng Hợp" : "Best Value Score",
        sortFn: (a, b) => b.overallScore - a.overallScore,
        valFn: item => item.overallScore + " pts",
        metaFn: item => formatNumber(item.totalMsgs) + (isVi ? ' tin · ' : ' msgs · ') + item.qualityPercent + (isVi ? '% chất lượng' : '% qual')
      },
      {
        title: isVi ? "Tin Nhắn Do Đối Phương Gửi" : "Messages Sent by Them",
        sortFn: (a, b) => b.oppositeMsgs - a.oppositeMsgs,
        valFn: item => formatNumber(item.oppositeMsgs) + (isVi ? " tin" : " msgs"),
        metaFn: item => item.oppShare.toFixed(1) + (isVi ? '% toàn bộ cuộc trò chuyện' : '% of conversation')
      },
      {
        title: isVi ? "Tin Nhắn Chất Lượng Từ Họ" : "Quality Messages from Them",
        sortFn: (a, b) => b.oppositeQuality - a.oppositeQuality,
        valFn: item => formatNumber(item.oppositeQuality) + (isVi ? " tin" : " msgs"),
        metaFn: item => item.oppQualityPercent.toFixed(1) + (isVi ? '% tỷ lệ chất lượng' : '% quality rate')
      },
      {
        title: isVi ? "Ký Tự Do Đối Phương Viết" : "Characters Written by Them",
        sortFn: (a, b) => b.oppositeChars - a.oppositeChars,
        valFn: item => formatChars(item.oppositeChars) + " chars",
        metaFn: item => formatNumber(item.oppositeChars) + (isVi ? ' ký tự' : ' characters')
      },
      {
        title: isVi ? "Tốc Độ Trả Lời (Họ → Tôi)" : "Reply Speed (Them → Me)",
        sortFn: (a, b) => (a.avgReplySecs || 9999999) - (b.avgReplySecs || 9999999),
        filterFn: x => x.avgReplySecs !== null && x.avgReplySecs > 0,
        valFn: item => item.avgReplyFormatted,
        metaFn: item => isVi ? ('Trung bình ' + Math.round(item.avgReplySecs) + ' giây') : (Math.round(item.avgReplySecs) + 's average')
      },
      {
        title: isVi ? "Quán Quân Cú Đêm (23h - 4h)" : "Night Owl Champion (11 PM - 4 AM)",
        sortFn: (a, b) => b.nightOwlMsgs - a.nightOwlMsgs,
        valFn: item => formatNumber(item.nightOwlMsgs) + (isVi ? " tin" : " msgs"),
        metaFn: item => item.nightOwlPercent.toFixed(1) + (isVi ? '% tổng số tin nhắn của họ' : '% of all their messages')
      },
      {
        title: isVi ? "Quán Quân Dậy Sớm (5h - 9h)" : "Early Bird Champion (5 AM - 9 AM)",
        sortFn: (a, b) => b.earlyBirdMsgs - a.earlyBirdMsgs,
        valFn: item => formatNumber(item.earlyBirdMsgs) + (isVi ? " tin" : " msgs"),
        metaFn: item => item.earlyBirdPercent.toFixed(1) + (isVi ? '% vào sáng sớm' : '% in early morning')
      },
      {
        title: isVi ? "Tỷ Trọng Nhắn Cuối Tuần" : "Weekend Chat Intensity",
        sortFn: (a, b) => b.weekendMsgs - a.weekendMsgs,
        valFn: item => formatNumber(item.weekendMsgs) + (isVi ? " tin" : " msgs"),
        metaFn: item => item.weekendPercent.toFixed(1) + (isVi ? '% vào cuối tuần' : '% on weekends')
      },
      {
        title: isVi ? "Bắn Tin Nhắn Liên Thanh" : "Rapid-Fire Message Bursts",
        sortFn: (a, b) => b.maxBurstCount - a.maxBurstCount,
        valFn: item => item.maxBurstCount + (isVi ? " tin liên tiếp" : " msgs in a row"),
        metaFn: item => isVi ? "Lượt gửi tin liên tục dài nhất" : "Longest non-stop single burst"
      },
      {
        title: isVi ? "Tin Nhắn Đơn Dài Nhất" : "Longest Single Monologue",
        sortFn: (a, b) => b.longestMsgChars - a.longestMsgChars,
        valFn: item => formatNumber(item.longestMsgChars) + " chars",
        metaFn: item => isVi ? "Một tin nhắn văn bản dài nhất" : "Single longest typed message"
      },
      {
        title: isVi ? "Tỷ Lệ Đối Phương Gửi Cao Nhất" : "Highest Opposite Share (% They Sent)",
        sortFn: (a, b) => b.oppShare - a.oppShare,
        filterFn: x => x.totalMsgs >= 200 && x.oppositeMsgs >= 50,
        valFn: item => item.oppShare.toFixed(1) + "%",
        metaFn: item => isVi ? ('Họ gửi ' + formatNumber(item.oppositeMsgs) + ' tin vs bạn gửi ' + formatNumber(item.myMsgs) + ' tin') : (formatNumber(item.oppositeMsgs) + ' sent vs ' + formatNumber(item.myMsgs) + ' by you')
      },
      {
        title: isVi ? "Số Ngày Hoạt Động Nhiều Nhất" : "Most Active Calendar Days",
        sortFn: (a, b) => b.activeDaysCount - a.activeDaysCount,
        valFn: item => item.activeDaysCount + (isVi ? " ngày" : " days"),
        metaFn: item => isVi ? "Số ngày có phát sinh tin nhắn" : "Distinct days with conversations"
      },
      {
        title: isVi ? "Độ Dài Tin Nhắn Trung Bình (Họ)" : "Average Message Length (Them)",
        sortFn: (a, b) => b.avgCharsOpp - a.avgCharsOpp,
        filterFn: x => x.oppositeMsgs >= 50,
        valFn: item => item.avgCharsOpp.toFixed(1) + " ch/msg",
        metaFn: item => formatNumber(item.oppositeChars) + (isVi ? ' ký tự qua ' : ' chars over ') + formatNumber(item.oppositeMsgs) + (isVi ? ' tin' : ' msgs')
      },
      {
        title: isVi ? "Cân Bằng Tương Tác 50/50" : "Mutual Conversation Balance (50/50)",
        sortFn: (a, b) => b.balanceFactor - a.balanceFactor,
        filterFn: x => x.totalMsgs >= 200 && x.oppositeMsgs >= 50,
        valFn: item => (item.balanceFactor * 100).toFixed(1) + (isVi ? "% cân bằng" : "% balance"),
        metaFn: item => isVi ? ('Bạn ' + item.myShare.toFixed(1) + '% vs Họ ' + item.oppShare.toFixed(1) + '%') : (item.myShare.toFixed(1) + '% you vs ' + item.oppShare.toFixed(1) + '% them')
      },
      {
        title: isVi ? "Tổng Số Tin Nhắn (Cả 2 Bên)" : "Total Messages (Both Sides)",
        sortFn: (a, b) => b.totalMsgs - a.totalMsgs,
        valFn: item => formatNumber(item.totalMsgs) + (isVi ? " tin" : " msgs"),
        metaFn: item => item.firstDate + ' → ' + item.lastDate
      },
      {
        title: isVi ? "Tin Nhắn Chất Lượng (Cả 2 Bên)" : "Quality Messages (Both Sides)",
        sortFn: (a, b) => b.qualityMessagesCount - a.qualityMessagesCount,
        valFn: item => formatNumber(item.qualityMessagesCount) + (isVi ? " tin" : " msgs"),
        metaFn: item => item.qualityPercent + (isVi ? '% tỷ lệ chất lượng' : '% quality rate')
      },
      {
        title: isVi ? "Cường Độ Nhắn Tin Mỗi Ngày" : "Daily Intensity (Pacing)",
        sortFn: (a, b) => b.dramaticScore - a.dramaticScore,
        valFn: item => Math.round(item.dramaticScore) + " msg/d",
        metaFn: item => item.activeDaysCount + (isVi ? ' ngày hoạt động' : ' active days')
      },
      {
        title: isVi ? "Chuỗi Ngày Nhắn Liên Tục" : "Longest Daily Streak",
        sortFn: (a, b) => b.maxStreak - a.maxStreak,
        valFn: item => item.maxStreak + (isVi ? " ngày" : " days"),
        metaFn: item => isVi ? 'Ngày liên tiếp không đứt quãng' : 'Consecutive days'
      },
      {
        title: isVi ? "Kỷ Lục Ngày Bùng Nổ Nhất" : "Peak Day Record",
        sortFn: (a, b) => b.peakDayCount - a.peakDayCount,
        valFn: item => formatNumber(item.peakDayCount) + (isVi ? " tin" : " msgs"),
        metaFn: item => (isVi ? 'vào ngày ' : 'on ') + item.peakDayDate
      },
      {
        title: isVi ? "Tổng Lượng Ký Tự (Cả 2 Bên)" : "Total Characters (Both Sides)",
        sortFn: (a, b) => b.totalChars - a.totalChars,
        valFn: item => formatChars(item.totalChars) + " chars",
        metaFn: item => formatNumber(item.totalChars) + (isVi ? ' ký tự' : ' characters')
      },
      {
        title: isVi ? "Thời Gian Đồng Hành Dài Nhất" : "Longest Friendship Span",
        sortFn: (a, b) => b.timeSpanDays - a.timeSpanDays,
        valFn: item => item.timeSpanFormatted,
        metaFn: item => formatNumber(item.timeSpanDays) + (isVi ? ' ngày gắn bó' : ' days span')
      }
    ];

    function renderCategoriesDynamic() {
      const container = document.getElementById('categories-container');
      container.innerHTML = '';

      dynamicCategories.forEach(cat => {
        let list = [...data];
        if (cat.filterFn) list = list.filter(cat.filterFn);
        list.sort(cat.sortFn);
        const topItems = list.slice(0, currentTopN);

        let itemsHtml = '';
        topItems.forEach((item, idx) => {
          const rankNum = idx + 1;
          itemsHtml += \`
            <div class="rank-item">
              <div class="rank-info">
                <span class="rank-badge rank-\${rankNum}">#\${rankNum}</span>
                <div>
                  <div class="rank-name">\${item.name}</div>
                  <div class="rank-meta">\${cat.metaFn(item)}</div>
                </div>
              </div>
              <div class="rank-val">\${cat.valFn(item)}</div>
            </div>
          \`;
        });

        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = \`
          <div class="category-card-header">\${cat.title}</div>
          <div class="category-items">\${itemsHtml}</div>
        \`;
        container.appendChild(card);
      });
    }

    function renderActivityChart() {
      const canvas = document.getElementById('activityChart');
      if (!canvas || typeof Chart === 'undefined') return;

      const metric = document.getElementById('graph-metric')?.value || 'all';
      const topNLimit = parseInt(document.getElementById('graph-topn')?.value || '10', 10);
      const grouping = document.getElementById('graph-group')?.value || 'weekly';

      // Pick top N contacts sorted by the chosen metric
      let sortedContacts = [...data];
      if (metric === 'opp') {
        sortedContacts.sort((a, b) => b.oppositeMsgs - a.oppositeMsgs);
      } else if (metric === 'my') {
        sortedContacts.sort((a, b) => b.myMsgs - a.myMsgs);
      } else if (metric === 'night') {
        sortedContacts.sort((a, b) => b.nightOwlMsgs - a.nightOwlMsgs);
      } else if (metric === 'quality') {
        sortedContacts.sort((a, b) => b.qualityMessagesCount - a.qualityMessagesCount);
      } else if (metric === 'chars') {
        sortedContacts.sort((a, b) => b.totalChars - a.totalChars);
      } else {
        sortedContacts.sort((a, b) => b.totalMsgs - a.totalMsgs);
      }
      sortedContacts = sortedContacts.slice(0, topNLimit);

      // Collect all unique sorted dates
      const allDateSet = new Set();
      data.forEach(c => {
        const counts = (metric === 'opp') ? c.dayCountsOpp :
                       (metric === 'my') ? c.dayCountsMy :
                       (metric === 'night') ? c.dayCountsNight :
                       (metric === 'quality') ? c.dayCountsQuality :
                       (metric === 'chars') ? c.dayCountsChars :
                       c.dayCounts;
        Object.keys(counts || {}).forEach(d => allDateSet.add(d));
      });
      const sortedDates = Array.from(allDateSet).sort();
      if (sortedDates.length === 0) return;

      let labels = [];
      let dateGroups = {};

      if (grouping === 'monthly') {
        const monthSet = new Set();
        sortedDates.forEach(d => {
          const mKey = d.slice(0, 7);
          monthSet.add(mKey);
          if (!dateGroups[mKey]) dateGroups[mKey] = [];
          dateGroups[mKey].push(d);
        });
        labels = Array.from(monthSet).sort();
      } else if (grouping === 'weekly') {
        sortedDates.forEach(d => {
          const dt = new Date(d);
          const day = dt.getDay();
          const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(dt.setDate(diff));
          const wKey = monday.toISOString().slice(0, 10);
          if (!dateGroups[wKey]) dateGroups[wKey] = [];
          dateGroups[wKey].push(d);
        });
        labels = Object.keys(dateGroups).sort();
      } else {
        labels = sortedDates;
        sortedDates.forEach(d => {
          dateGroups[d] = [d];
        });
      }

      const datasets = sortedContacts.map((contact, idx) => {
        const color = PALETTE[idx % PALETTE.length];
        const dayMap = (metric === 'opp') ? (contact.dayCountsOpp || {}) :
                       (metric === 'my') ? (contact.dayCountsMy || {}) :
                       (metric === 'night') ? (contact.dayCountsNight || {}) :
                       (metric === 'quality') ? (contact.dayCountsQuality || {}) :
                       (metric === 'chars') ? (contact.dayCountsChars || {}) :
                       (contact.dayCounts || {});

        let runningSum = 0;
        const dataPoints = labels.map(labelKey => {
          const datesInGroup = dateGroups[labelKey] || [];
          let periodSum = 0;
          datesInGroup.forEach(d => {
            periodSum += (dayMap[d] || 0);
          });
          if (metric === 'growth') {
            runningSum += periodSum;
            return runningSum;
          }
          return periodSum;
        });

        return {
          label: contact.name,
          data: dataPoints,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: labels.length > 50 ? 0 : 2,
          pointHoverRadius: 6,
          tension: 0.35,
          fill: false
        };
      });

      if (chartInstance) {
        chartInstance.destroy();
      }

      chartInstance = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                color: '#FAF9F5',
                font: { family: "Anthropic Sans, sans-serif", size: 12 },
                boxWidth: 12,
                padding: 12,
                usePointStyle: true
              }
            },
            tooltip: {
              backgroundColor: '#1E1E1D',
              titleColor: '#FAF9F5',
              bodyColor: '#B0AEA5',
              borderColor: '#2C2C2A',
              borderWidth: 1,
              padding: 12,
              titleFont: { family: "Anthropic Sans, sans-serif", size: 13, weight: 'bold' },
              bodyFont: { family: "Anthropic Mono, monospace", size: 12 },
              callbacks: {
                label: function(ctx) {
                  const val = ctx.parsed.y || 0;
                  const unit = metric === 'chars' ? (isVi ? ' ký tự' : ' chars') : (isVi ? ' tin' : ' msgs');
                  return ' ' + ctx.dataset.label + ': ' + val.toLocaleString() + unit;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: '#242422' },
              ticks: {
                color: '#75736C',
                font: { family: "Anthropic Mono, monospace", size: 11 },
                maxRotation: 45
              }
            },
            y: {
              grid: { color: '#242422' },
              ticks: {
                color: '#75736C',
                font: { family: "Anthropic Mono, monospace", size: 11 },
                callback: function(val) {
                  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
                  if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
                  return val;
                }
              }
            }
          }
        }
      });
    }

    function toggleAllSpoilers(isSpoiled) {
      const cards = document.querySelectorAll('.insight-card');
      cards.forEach(card => {
        if (isSpoiled) {
          card.classList.add('spoiled');
        } else {
          card.classList.remove('spoiled');
        }
      });
    }

    function revealCardSpoiler(card) {
      if (card.classList.contains('spoiled')) {
        card.classList.remove('spoiled');
      }
    }

    async function saveCardAsImage(btn, event) {
      if (event) event.stopPropagation();
      const card = btn.closest('.insight-card');
      if (!card) return;

      const originalBtnHtml = btn.innerHTML;
      btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>';
      btn.style.pointerEvents = 'none';

      const hadSpoiled = card.classList.contains('spoiled');
      if (hadSpoiled) card.classList.remove('spoiled');

      const footerEl = card.querySelector('.insight-footer');
      const originalFooterDisplay = footerEl ? footerEl.style.display : '';
      if (footerEl) footerEl.style.display = 'none';

      const watermark = card.querySelector('.card-watermark');
      if (watermark) watermark.style.display = 'block';
      btn.style.opacity = '0';

      try {
        if (typeof html2canvas === 'undefined') {
          alert(isVi ? 'Đang tải thư viện xử lý ảnh, vui lòng thử lại sau giây lát.' : 'Image processing library is still loading, please try again in a second.');
          return;
        }

        const canvas = await html2canvas(card, {
          backgroundColor: '#1E1E1D',
          scale: 2,
          useCORS: true,
          logging: false
        });

        const link = document.createElement('a');
        const tagEl = card.querySelector('.insight-tag');
        const rawTag = tagEl ? tagEl.textContent : 'buddies-wrapped';
        const safeTag = rawTag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        link.download = 'buddies-wrapped-' + (safeTag || 'card') + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error('Failed to capture card image:', err);
      } finally {
        btn.innerHTML = originalBtnHtml;
        btn.style.pointerEvents = '';
        btn.style.opacity = '1';
        if (footerEl) footerEl.style.display = originalFooterDisplay;
        if (watermark) watermark.style.display = '';
        if (hadSpoiled && document.getElementById('spoiler-toggle')?.checked) {
          card.classList.add('spoiled');
        }
      }
    }

    function filterTable(tableId, query) {
      const q = query.toLowerCase().trim();
      const rows = document.querySelectorAll('#' + tableId + ' tbody tr');
      rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        r.style.display = text.includes(q) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;
}

async function main() {
  console.log("\n=======================================================");
  console.log("BUDDIES WRAPPED - CHAT YEAR IN REVIEW");
  console.log("A tiny script by Duncuti 🐱");
  console.log("=======================================================\n");

  const currentDir = process.cwd();
  console.log(`Scanning directory: ${currentDir}`);

  const files = discoverJsonFiles(currentDir);
  if (files.length === 0) {
    console.error("No chat JSON files found in current directory or subfolders.");
    console.log("Tip: Place this script into the folder containing your message JSON files and run: npx buddies-wrapper\n");
    process.exit(1);
  }

  console.log(`Discovered ${files.length} chat JSON files.`);

  // Auto-detect Sender Profile Name
  const detected = detectSenderIdentity(files);
  const detectedName = detected.identity;
  console.log(`Auto-detected identity: "${detectedName}"`);
  if (detected.candidates && detected.candidates.length > 1) {
    console.log(`Suggested candidates: ${detected.candidates.join(", ")}\n`);
  } else {
    console.log("");
  }

  // Initialize interactive prompter
  const prompter = createPrompter();

  // Prompt 1: Your Identity
  const answerName = await prompter.ask(`Your Identity (correct letter) [default: "${detectedName}"]: `);
  const myName = answerName.trim() || detectedName;
  console.log(`Selected Identity: "${myName}"\n`);

  // Prompt 2: Report Language
  const answerLang = await prompter.ask("Report Lang: EN/VI [default: EN]: ");
  const lang = (answerLang.trim().toUpperCase().startsWith("VI") || answerLang.trim() === "2") ? "VI" : "EN";
  const isVi = lang === "VI";
  console.log(`Selected Language: ${isVi ? "Tiếng Việt (VI)" : "English (EN)"}\n`);

  // Default Top N ranking depth
  const topN = 3;

  // Process all files with the specified user profile identity
  console.log(isVi ? "✨ Đang phân tích dữ liệu cuộc trò chuyện..." : "✨ Processing conversation archives...");
  const conversations = [];
  let globalEarliestTs = null;
  let globalLatestTs = null;
  let grandTotalMessages = 0;
  let grandTotalChars = 0;
  let grandTotalWords = 0;

  for (const f of files) {
    const res = analyzeConversation(f, myName);
    if (res) {
      conversations.push(res);
      grandTotalMessages += res.totalMsgs;
      grandTotalChars += res.totalChars;
      grandTotalWords += res.totalWords || 0;
      if (res.firstTs && (globalEarliestTs === null || res.firstTs < globalEarliestTs)) {
        globalEarliestTs = res.firstTs;
      }
      if (res.lastTs && (globalLatestTs === null || res.lastTs > globalLatestTs)) {
        globalLatestTs = res.lastTs;
      }
    }
  }

  if (conversations.length === 0) {
    console.error("No valid conversations could be parsed.");
    prompter.close();
    process.exit(1);
  }

  const globalTotalDays = globalEarliestTs && globalLatestTs
    ? Math.max(1, Math.round((globalLatestTs - globalEarliestTs) / (1000 * 60 * 60 * 24)))
    : 0;

  const startDateFormatted = formatDate(globalEarliestTs);
  const endDateFormatted = formatDate(globalLatestTs);
  const totalDurationText = formatDuration(globalTotalDays);

  // Write output HTML file
  const htmlContent = generateHtmlReport({
    conversations,
    startDateFormatted,
    endDateFormatted,
    totalDurationText,
    globalTotalDays,
    grandTotalMessages,
    grandTotalChars,
    grandTotalWords,
    topN,
    lang,
    myName
  });
  const htmlOutputPath = path.join(currentDir, "CHAT_OVERVIEW.html");
  fs.writeFileSync(htmlOutputPath, htmlContent, "utf-8");

  if (isVi) {
    console.log("\n🎉 Chúc mừng! Báo cáo Buddies Wrapped của bạn đã sẵn sàng!");
    console.log(`📁 File đã lưu tại: ${htmlOutputPath}\n`);
  } else {
    console.log("\n🎉 Congratulations! Your Buddies Wrapped dashboard is ready!");
    console.log(`📁 File saved to: ${htmlOutputPath}\n`);
  }

  const askOpenText = isVi
    ? "Bạn có muốn mở báo cáo ngay bây giờ không? (Y/n): "
    : "Do you want to open the report now? (Y/n): ";

  const answerOpen = await prompter.ask(askOpenText);
  prompter.close();

  const shouldOpen = answerOpen === "" || answerOpen.toLowerCase().startsWith("y") || answerOpen.toLowerCase().startsWith("c");
  if (shouldOpen) {
    if (isVi) {
      console.log("🚀 Đang mở báo cáo trên trình duyệt mặc định... Chúc bạn xem vui vẻ!\n");
    } else {
      console.log("🚀 Opening dashboard in your default browser... Enjoy!\n");
    }
    openFile(htmlOutputPath);
  } else {
    if (isVi) {
      console.log(`Bạn có thể mở báo cáo bất kỳ lúc nào bằng lệnh: open "${htmlOutputPath}"\n`);
    } else {
      console.log(`You can open the report anytime with: open "${htmlOutputPath}"\n`);
    }
  }
}

main();

