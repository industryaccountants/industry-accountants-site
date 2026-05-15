const SUPABASE_URL = 'https://zshxoqbewsxmstlnzwvr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzaHhvcWJld3N4bXN0bG56d3ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMDA1NTIsImV4cCI6MjA5MTg3NjU1Mn0.IXCe-xUdBkspmvtC32tb8_0saN41rKUB6QD6xUcZXC0';

const TALLY_FORMS = {
  tax:          'https://tally.so/r/wM0aN8',
  bookkeeping:  'https://tally.so/r/wbaej7',
  payroll:      'https://tally.so/r/npgoyP',
  consulting:   'https://tally.so/r/mORX4M',
  partner:      'https://tally.so/r/3yO42d',
};

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
