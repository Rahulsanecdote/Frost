"""Offline survey aggregation; never invoked by runtime, CI or tests.
Only aggregate probabilities are published. Raw public-use records stay in ignored cache.
Fermented and herbs_spices remain PLACEHOLDER, not survey-derived. Logging is not measured.
"""
import argparse
import hashlib
import json
import math
from decimal import Decimal
from pathlib import Path
from urllib.request import urlopen
import pandas as pd

PACKAGE = Path(__file__).resolve().parents[2]
SOURCES = {
    'P_DR1IFF.xpt': ('https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DR1IFF.xpt', '264a4dfd66455f106a8ac25a745ebb4e065564b049b45000a5f9c44296d48dec'),
    'P_DEMO.xpt': ('https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/P_DEMO.xpt', '2e46c6c26bf77cd8989f64011ace12cbf42c0f3e03414eb59acc5328c8f87913'),
    'FPED_1720.xls': ('https://www.ars.usda.gov/ARSUserFiles/80400530/apps/FPED_1720.xls', '15e91a1059d74a861a507d80e4eed7bd9b97fa9239ad9350be6e52ae9751b94c'),
}
# Exact codebook spelling, including Desayano. Mapping is a declared modelling choice.
OCCASIONS = {1:('Breakfast','breakfast'),2:('Lunch','lunch'),3:('Dinner','dinner'),4:('Supper','dinner'),5:('Brunch','breakfast'),6:('Snack','snack'),7:('Drink','other'),8:('Infant feeding','other'),9:('Extended consumption','other'),10:('Desayano','breakfast'),11:('Almuerzo','lunch'),12:('Comida','lunch'),13:('Merienda','snack'),14:('Cena','dinner'),15:('Entre comida','snack'),16:('Botana','snack'),17:('Bocadillo','snack'),18:('Tentempie','snack'),19:('Bebida','other'),91:('Other','other'),99:("Don't know",'other')}
COMPONENTS = {'vegetables':['V_TOTAL'],'fruits':['F_TOTAL'],'legumes':['PF_LEGUMES'],'grains':['G_TOTAL'],'dairy':['D_TOTAL'],'eggs':['PF_EGGS'],'fish_seafood':['PF_SEAFD_HI','PF_SEAFD_LOW'],'meat_poultry':['PF_MEAT','PF_CUREDMEAT','PF_ORGAN','PF_POULT'],'nuts_seeds':['PF_NUTSDS'],'fats_oils':['OILS','SOLID_FATS'],'fermented':[],'herbs_spices':[]}
CODEBOOK = 'https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/'
GUIDE = 'https://www.ars.usda.gov/ARSUserFiles/80400530/pdf/fped/Amended%20FPED%202017-2018%20documentation%20for%20Use%20with%20WWEIA%20NHANES%202017-March%202020%20Prepandemic.pdf'
VARIABLES = {v:CODEBOOK+'P_DR1IFF.htm#'+v for v in ['SEQN','WTDRD1PP','DR1DRSTZ','DR1DAY','DR1_030Z','DR1IFDCD','DR1IGRMS']}
VARIABLES['RIDAGEYR'] = CODEBOOK+'P_DEMO.htm#RIDAGEYR'

def canonical(value):
    # Match the existing engine's canonical JSON, including JS decimal/exponent thresholds.
    if value is None or isinstance(value, (str, bool)):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, int): return str(value)
    if isinstance(value, float):
        if not math.isfinite(value): raise ValueError('Non-finite JSON number')
        if value == 0: return '0'
        if 1e-6 <= abs(value) < 1e21:
            decimal = format(Decimal(str(value)), 'f')
            return decimal.rstrip('0').rstrip('.') if '.' in decimal else decimal
        return repr(value).replace('e-0','e-').replace('e+0','e+')
    if isinstance(value, list): return '['+','.join(canonical(item) for item in value)+']'
    if isinstance(value, dict): return '{'+','.join(canonical(key)+':'+canonical(value[key]) for key in sorted(value))+'}'
    raise TypeError('Only JSON values may be canonicalized')

def sources(cache, offline):
    cache.mkdir(parents=True,exist_ok=True)
    for filename,(url,expected) in SOURCES.items():
        path=cache/filename
        if not path.exists():
            if offline: raise ValueError('Missing cached source: '+filename)
            with urlopen(url,timeout=180) as response: data=response.read()
            if hashlib.sha256(data).hexdigest()!=expected: raise ValueError('Download checksum mismatch: '+filename)
            path.write_bytes(data)
        if hashlib.sha256(path.read_bytes()).hexdigest()!=expected: raise ValueError('Cached checksum mismatch: '+filename)

def generate(cache):
    foods=pd.read_sas(cache/'P_DR1IFF.xpt',format='xport')[['SEQN','WTDRD1PP','DR1DRSTZ','DR1DAY','DR1_030Z','DR1IFDCD','DR1IGRMS']]
    demo=pd.read_sas(cache/'P_DEMO.xpt',format='xport')[['SEQN','RIDAGEYR']]
    fped=pd.read_excel(cache/'FPED_1720.xls',sheet_name='FPED_1720_')
    fped.columns=[str(c).split(' (')[0] for c in fped.columns]
    cols=sorted({c for values in COMPONENTS.values() for c in values})
    if fped['FOODCODE'].duplicated().any(): raise ValueError('Nonunique FPED food code')
    if fped[cols].isna().any().any() or (fped[cols]<0).any().any(): raise ValueError('Missing/negative FPED equivalents')
    foods=foods.merge(demo,on='SEQN',validate='many_to_one',how='left')
    if foods['RIDAGEYR'].isna().any(): raise ValueError('Missing age linkage')
    foods=foods.loc[(foods.RIDAGEYR>=13)&(foods.DR1DRSTZ==1)&(foods.WTDRD1PP>0)].copy()
    if foods.isna().any().any(): raise ValueError('Missing analysis variable')
    if not foods.DR1DAY.isin(range(1,8)).all(): raise ValueError('Unknown intake day')
    if not foods.DR1_030Z.isin(OCCASIONS).all(): raise ValueError('Unmapped occasion code')
    if (foods.DR1IGRMS<0).any(): raise ValueError('Negative consumed quantity')
    foods=foods.merge(fped[['FOODCODE']+cols],left_on='DR1IFDCD',right_on='FOODCODE',how='left',validate='many_to_one')
    if foods.FOODCODE.isna().any(): raise ValueError('Unmatched FPED food code; do not treat as absence')
    foods['slot']=foods.DR1_030Z.map({k:v[1] for k,v in OCCASIONS.items()})
    foods['dayType']=foods.DR1DAY.map(lambda day:'weekend' if day in (1,7) else 'weekday')
    for group,components in COMPONENTS.items():
        if components: foods[group]=(foods[components].sum(axis=1)>0)&(foods.DR1IGRMS>0)
    # Collapse food lines before weighting: one weight per respondent/slot, never per food.
    consistency=foods.groupby('SEQN')[['WTDRD1PP','DR1DAY']].nunique()
    if (consistency>1).any().any(): raise ValueError('Inconsistent recall weight or day')
    recalls=foods.groupby(['SEQN','slot','dayType'],sort=True).agg({'WTDRD1PP':'first',**{g:'max' for g,c in COMPONENTS.items() if c}}).reset_index()
    table={}
    for slot in ['breakfast','lunch','dinner','snack','other']:
        pooled=recalls.loc[recalls.slot==slot]
        if len(pooled)==0: raise ValueError('Empty pooled slot')
        table[slot]={}
        for day_type in ['weekday','weekend']:
            cell=pooled.loc[pooled.dayType==day_type];n=len(cell);use_pool=n<100
            selected=pooled if use_pool else cell
            denominator=math.fsum(selected.WTDRD1PP.tolist())
            groups={}
            for group,components in COMPONENTS.items():
                mu=round(math.fsum(selected.loc[selected[group],'WTDRD1PP'].tolist())/denominator,9) if components else 0.5
                if mu==int(mu): mu=int(mu)  # JSON numeric canonicalization agrees with JavaScript.
                groups[group]={'mu':mu,'surveyDerived':bool(components)}
            table[slot][day_type]={'n':n,'pooled':use_pool,'groups':groups}
    return {'cycle':'2017-March 2020 prepandemic','generatedDate':'2026-10-15','population':'Ages thirteen and over; reliable Day 1 recalls; positive day-one dietary weights. Age restriction is a modelling choice.',
      'weightVariable':'WTDRD1PP','reliableRecall':'DR1DRSTZ = 1','dayTypes':'Mon–Fri weekday; Sat–Sun weekend (not the weighting documentation’s Fri–Sun convention).',
      'event':'Group present in at least one food in the slot, conditional on that respondent reporting the slot on Day 1.',
      'cycleRationale':'Newest paired WWEIA individual-foods and FPED release listed by USDA when generated; newer dietary files lack a matching published FPED release.',
      'citations':['National Center for Health Statistics. National Health and Nutrition Examination Survey, 2017–March 2020 Prepandemic: Dietary Interview, Individual Foods, First Day and Demographics. Hyattsville, MD: Centers for Disease Control and Prevention.', 'Waller AW, Friday JE, Morton S, Myrowitz R, Moshfegh AJ. 2023. Food Patterns Equivalents Database for Use with WWEIA, NHANES 2017-March 2020 Prepandemic. USDA Agricultural Research Service, Food Surveys Research Group. July 2023.'],
      'codebooks':VARIABLES,'fpedGuide':GUIDE,'components':COMPONENTS,
      'occasionMapping':{str(k):{'name':v[0],'slot':v[1]} for k,v in OCCASIONS.items()},
      'sourceFiles':{name:{'url':url,'sha256':sha} for name,(url,sha) in SOURCES.items()},
      'standardErrors':'Not estimated; weighted descriptive means, not design-based uncertainty or evidence of forecast calibration.',
      'pooledRule':'If n < 100, use all weekday+weekend recalls for the same slot. n counts distinct respondents with that slot, not food lines.',
      'notSurveyDerived':['fermented','herbs_spices'],'table':table,'contentHash':hashlib.sha256(canonical(table).encode()).hexdigest()}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--offline',action='store_true');parser.add_argument('--cache',type=Path,default=PACKAGE/'.cache/priors');parser.add_argument('--out',type=Path,default=PACKAGE/'priors/nhanes-wweia-2017-2020.json');args=parser.parse_args()
    sources(args.cache,args.offline);result=generate(args.cache);args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(canonical(result)+'\n',encoding='utf-8')
    print('Wrote aggregate prior table; SHA-256 '+result['contentHash'])
    print('Cell counts / pooled: '+canonical({s:{d:{'n':c['n'],'pooled':c['pooled']} for d,c in days.items()} for s,days in result['table'].items()}))
if __name__=='__main__':main()
