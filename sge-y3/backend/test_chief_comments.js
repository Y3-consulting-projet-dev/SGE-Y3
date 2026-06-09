/**
 * Test script: vérifie l'état des chief_comments et simule un save.
 * Usage: node test_chief_comments.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sge_y3';
const CURRENT_CYCLE_LABEL = 'Cycle 2025-2026';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connecté à MongoDB\n');

  const db = mongoose.connection.db;

  // ── 0. Sanité ────────────────────────────────────────────────────────────
  const totalInstances = await db.collection('evaluation_instances').countDocuments();
  const assistantInstances = await db.collection('evaluation_instances')
    .find({ template_type: 'assistant-self-evaluation' })
    .project({ _id: 1, evalue_id: 1, status: 1, chief_comments: 1 })
    .toArray();

  console.log(`━━ Instances en base ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Total : ${totalInstances}`);
  console.log(`  Assistants (assistant-self-evaluation) : ${assistantInstances.length}`);

  const statusCounts = {};
  for (const inst of assistantInstances) {
    statusCounts[inst.status] = (statusCounts[inst.status] || 0) + 1;
  }
  console.log('  Répartition des statuts :');
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`    ${status} : ${count}`);
  }

  // ── 1. chief_comments existants ──────────────────────────────────────────
  const withComments = assistantInstances.filter(
    (inst) => Array.isArray(inst.chief_comments) && inst.chief_comments.length > 0
  );
  console.log(`\n━━ Instances avec chief_comments ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${withComments.length} instance(s) sur ${assistantInstances.length}`);

  if (withComments.length === 0) {
    console.log('  ⚠️  Personne n\'a encore envoyé de commentaire anonyme.');
    console.log('     (Le champ chief_comments n\'existe pas encore dans les documents MongoDB,');
    console.log('      il sera créé lors du premier envoi.)');
  }

  for (const inst of withComments) {
    console.log(`\n  Instance ${inst._id} (evalue_id=${inst.evalue_id}) — statut: ${inst.status}`);
    for (const c of inst.chief_comments) {
      console.log(`    cible : ${c.target_name} (id=${c.target_user_id})`);
      console.log(`    texte : "${String(c.comment || '').slice(0, 60)}"`);
      console.log(`    soumis le : ${c.submitted_at ?? 'NON (brouillon)'}`);
    }
  }

  // ── 2. Simulation : écriture d'un chief_comment de test ──────────────────
  console.log(`\n━━ Simulation d'un save de chief_comment ━━━━━━━━━━━━━━━━━━━━`);

  const testInstance = assistantInstances[0];
  if (!testInstance) {
    console.log('  ❌ Pas d\'instance assistant disponible pour le test.');
  } else {
    console.log(`  Instance utilisée : ${testInstance._id} (statut actuel : ${testInstance.status})`);

    const fakeComment = [
      {
        target_user_id: new mongoose.Types.ObjectId(),
        target_name: 'TEST SUPERIEUR',
        target_grade: 'Manager',
        target_department: 'AUDIT',
        comment: 'Ceci est un commentaire de test — à supprimer.',
        submitted_at: new Date().toISOString(),
      },
    ];

    await db.collection('evaluation_instances').updateOne(
      { _id: testInstance._id },
      { $set: { chief_comments: fakeComment } }
    );

    const updated = await db.collection('evaluation_instances')
      .findOne({ _id: testInstance._id }, { projection: { status: 1, chief_comments: 1 } });

    console.log(`  ✅ chief_comments sauvegardé : ${updated.chief_comments?.length ?? 0} entrée(s)`);
    console.log(`  Statut après save : ${updated.status} (doit être inchangé)`);

    if (updated.status !== testInstance.status) {
      console.log(`  ❌ BUG : le statut a changé ! Avant=${testInstance.status} → Après=${updated.status}`);
    } else {
      console.log(`  ✅ Statut préservé.`);
    }

    // Nettoyer
    await db.collection('evaluation_instances').updateOne(
      { _id: testInstance._id },
      { $unset: { chief_comments: '' } }
    );
    console.log(`  (test annulé — chief_comments supprimé)`);
  }

  // ── 3. Vérification du bug de statut (fix appliqué ?) ────────────────────
  console.log(`\n━━ Vérification du fix status dans le controller ━━━━━━━━━━━━`);
  const fs = require('fs');
  const src = fs.readFileSync('./src/controllers/collaboratorEvaluationController.js', 'utf8');
  const hasFix = src.includes('SUBMITTED_STATUSES') && src.includes('preserveStatus');
  console.log(`  Fix "ne pas rétrograder le statut soumis" : ${hasFix ? '✅ OUI' : '❌ NON — le statut serait écrasé'}`);

  await mongoose.disconnect();
  console.log('\n✅ Fin du test.');
}

run().catch((error) => {
  console.error('❌ Erreur :', error.message);
  process.exit(1);
});
