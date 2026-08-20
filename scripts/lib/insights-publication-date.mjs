function toJstDateParts(iso) {
  if (!iso) return null;

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.toLocaleString('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
  });
  const m = d.toLocaleString('en-CA', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
  });
  const day = d.toLocaleString('en-CA', {
    timeZone: 'Asia/Tokyo',
    day: '2-digit',
  });

  return {
    ymd: `${y}-${m}-${day}`,
    dot: `${y}.${m}.${day}`,
  };
}

export function syncInsightPublicationDate(html, publishAt) {
  const parts = toJstDateParts(publishAt);
  if (!parts) {
    return {
      html,
      changed: false,
      reason: 'missing_or_invalid_publishAt',
    };
  }

  const { ymd, dot } = parts;
  let next = html;

  next = next.replace(
    /("datePublished"\s*:\s*")\d{4}-\d{2}-\d{2}(")/,
    `$1${ymd}$2`
  );

  next = next.replace(
    /("dateModified"\s*:\s*")\d{4}-\d{2}-\d{2}(")/,
    `$1${ymd}$2`
  );

  next = next.replace(
    /(<time\b[^>]*datetime=")\d{4}-\d{2}-\d{2}("[^>]*>)\d{4}\.\d{2}\.\d{2}(<\/time>)/,
    `$1${ymd}$2${dot}$3`
  );

  next = next.replace(
    /(Version 1\.0 · Last Updated )\d{4}-\d{2}-\d{2}/,
    `$1${ymd}`
  );

  return {
    html: next,
    changed: next !== html,
    ymd,
    dot,
  };
}
