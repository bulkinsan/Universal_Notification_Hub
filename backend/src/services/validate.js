const SOURCE_FIELDS = {
  name: { max: 100 },
  domain: { max: 255 },
  description: { max: 4000 },
  website_url: { max: 255 },
};

function str(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function validateSourceInput(body) {
  const errors = [];
  if (body.name === undefined && body.description === undefined && body.website_url === undefined) {
    return { ok: true };
  }
  for (const field of ['name', 'description', 'website_url']) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string') {
        errors.push(`${field} must be a string`);
      } else if (body[field].length > SOURCE_FIELDS[field].max) {
        errors.push(`${field} must be ${SOURCE_FIELDS[field].max} characters or less`);
      }
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

function validateCreateSource(body) {
  const errors = [];
  if (!str(body.name)) errors.push('name is required and must be a non-empty string');
  if (body.name && body.name.length > SOURCE_FIELDS.name.max) {
    errors.push(`name must be ${SOURCE_FIELDS.name.max} characters or less`);
  }
  if (!str(body.domain)) errors.push('domain is required and must be a non-empty string');
  if (body.domain && body.domain.length > SOURCE_FIELDS.domain.max) {
    errors.push(`domain must be ${SOURCE_FIELDS.domain.max} characters or less`);
  }
  const nested = validateSourceInput(body);
  if (!nested.ok) errors.push(...nested.errors);
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

function validateSubscribe(body) {
  const errors = [];
  if (!str(body.source_id)) errors.push('source_id is required');
  if (!str(body.device_type)) errors.push('device_type is required');
  if (body.device_type && !['pwa', 'native_ios'].includes(body.device_type)) {
    errors.push('device_type must be pwa or native_ios');
  }
  if (body.push_subscription !== undefined && body.push_subscription !== null && typeof body.push_subscription !== 'object') {
    errors.push('push_subscription must be an object');
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

function validateUnsubscribe(body) {
  const errors = [];
  if (!str(body.user_id)) errors.push('user_id is required');
  if (!str(body.source_id)) errors.push('source_id is required');
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

function validateNotify(body) {
  const errors = [];
  if (!str(body.title)) errors.push('title is required and must be a non-empty string');
  if (body.title && body.title.length > 255) errors.push('title must be 255 characters or less');
  if (body.body !== undefined && body.body !== null && typeof body.body !== 'string') {
    errors.push('body must be a string');
  }
  if (body.data !== undefined && body.data !== null && (typeof body.data !== 'object' || Array.isArray(body.data))) {
    errors.push('data must be a JSON object');
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

function validateLogin(body) {
  const errors = [];
  if (!str(body.username)) errors.push('username is required');
  if (!str(body.password)) errors.push('password is required');
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

function validateId(id) {
  if (!id || !/^[0-9a-fA-F-]{8,64}$/.test(id)) return false;
  return true;
}

module.exports = {
  validateCreateSource,
  validateSourceInput,
  validateSubscribe,
  validateUnsubscribe,
  validateNotify,
  validateLogin,
  validateId,
};
