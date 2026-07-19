import ejs from 'ejs';
import fs from 'fs-extra';
import path from 'node:path';
import type { WorkloadModel } from '../types.js';
import { determineAWSTopology } from '../pricing/aws-sizer.js';

export interface CompilerContext {
  region: string;
  app_port?: number;
  fargate_cpu?: string;
  fargate_memory?: string;
  db_port?: number;
  db_engine?: string;
  db_instance_class?: string;
}

export class IaCCompiler {
  private templatesDir: string;

  constructor(templatesDir: string) {
    this.templatesDir = templatesDir;
  }

  async compile(workload: WorkloadModel, outDir: string): Promise<void> {
    const context = this.buildContext(workload);

    // Create output directory safely
    await fs.ensureDir(outDir);

    const templatesToCompile = ['provider.tf.ejs', 'network.tf.ejs', 'security.tf.ejs', 'outputs.tf.ejs'];

    if (context.fargate_cpu) {
      templatesToCompile.push('compute-fargate.tf.ejs');
    }
    
    if (context.db_engine) {
      templatesToCompile.push('db-rds.tf.ejs');
    }

    for (const template of templatesToCompile) {
      const templatePath = path.join(this.templatesDir, 'aws', template);
      const outPath = path.join(outDir, template.replace('.ejs', ''));

      const templateStr = await fs.readFile(templatePath, 'utf-8');
      const compiled = ejs.render(templateStr, context);
      
      await fs.writeFile(outPath, compiled, 'utf-8');
    }
  }

  private buildContext(workload: WorkloadModel): CompilerContext {
    const resources = determineAWSTopology(workload);
    const context: CompilerContext = {
      region: workload.deploymentRegion,
    };

    const compute = resources.find(r => r.type === 'compute');
    if (compute) {
      context.app_port = 3000;
      if (compute.sku === 'fargate-micro') {
        context.fargate_cpu = '256'; // 0.25 vCPU in ECS units
        context.fargate_memory = '512';
      } else {
        context.fargate_cpu = '1024'; // 1 vCPU
        context.fargate_memory = '2048';
      }
    }

    const database = resources.find(r => r.type === 'database');
    if (database) {
      if (workload.topology.database === 'postgres') {
        context.db_port = 5432;
        context.db_engine = 'postgres';
      } else if (workload.topology.database === 'mysql') {
        context.db_port = 3306;
        context.db_engine = 'mysql';
      } else if (workload.topology.database === 'mongodb') {
        context.db_port = 27017;
        context.db_engine = 'docdb';
      }

      if (database.sku.includes('micro')) {
        context.db_instance_class = 'db.t4g.micro';
      } else {
        context.db_instance_class = 'db.t4g.medium';
      }
    }

    return context;
  }
}
