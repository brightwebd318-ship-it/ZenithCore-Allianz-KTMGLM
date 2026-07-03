const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      filelist = walkSync(dirFile, filelist);
    } catch (err) {
      if (err.code === 'ENOTDIR' || err.code === 'EBUSY') filelist.push(dirFile);
    }
  });
  return filelist;
};

const replaceInFile = (file) => {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.json')) return;
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Exact Matches
  content = content.replace(/Zenith Core Alliance/g, 'PraxDoc');
  content = content.replace(/Zenith Medical Alliance Workspace/g, 'PraxDoc Workspace');
  content = content.replace(/Zenith Ortho-Rehab Care/g, 'PraxDoc Clinic');
  content = content.replace(/Zenith Medical Workspace Alliance Panel/g, 'PraxDoc Workspace Panel');
  content = content.replace(/ZenithCore Alliance/gi, 'PraxDoc');
  content = content.replace(/ZenithCore Medical SaaS/gi, 'PraxDoc Medical SaaS');
  content = content.replace(/ZenithCore/gi, 'PraxDoc');
  content = content.replace(/zenithcore\.com/g, 'praxdoc.com');
  content = content.replace(/zenithortho/g, 'praxdoc_clinic');
  content = content.replace(/Zenith Blue/g, 'PraxDoc Blue');
  content = content.replace(/ZenithAdminSecure123/g, 'PraxDocAdminSecure123');

  // Keys
  content = content.replace(/zenith_inventory/g, 'praxdoc_inventory');
  content = content.replace(/zenith_users/g, 'praxdoc_users');
  content = content.replace(/zenith_mock_auth_statuses/g, 'praxdoc_mock_auth_statuses');
  content = content.replace(/zenith_session/g, 'praxdoc_session');
  content = content.replace(/zenith_tenant_logo_name/g, 'praxdoc_tenant_logo_name');
  content = content.replace(/zenith_tenant_logo_/g, 'praxdoc_tenant_logo_');
  content = content.replace(/zenith_theme/g, 'praxdoc_theme');
  content = content.replace(/zenith_/g, 'praxdoc_');
  content = content.replace(/ZENITH-AUTH/g, 'PRAXDOC-AUTH');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated: ${file}`);
  }
};

const srcFiles = walkSync(path.join(__dirname, 'src'));
srcFiles.forEach(replaceInFile);
console.log('Renaming complete.');
